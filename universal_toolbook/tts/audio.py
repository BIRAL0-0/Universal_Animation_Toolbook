"""Reusable audio processing & analysis for the TTS subsystem.

Everything here is pure numpy + the stdlib ``wave`` module (plus ffmpeg for
MP3). No aggressive compression: the processing chain is

    resample -> normalize (peak and/or RMS) -> soft peak limit

and the ORIGINAL file is always preserved next to the processed one.

Functions are deliberately small and side-effect free so they can be used by
the CLI tools, the animation pipeline, and the tests alike.
"""

from __future__ import annotations

import shutil
import struct
import subprocess
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np

__all__ = [
    "Analysis",
    "read_wav",
    "write_wav",
    "resample",
    "normalize_peak",
    "normalize_rms",
    "soft_limit",
    "analyze",
    "check_file",
    "process_audio",
    "get_ffmpeg_exe",
    "encode_mp3",
]


# ---------------------------------------------------------------- ffmpeg
def get_ffmpeg_exe() -> str:
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            "FFmpeg binary not found on PATH and imageio-ffmpeg is unavailable. "
            "Install it with: pip install imageio-ffmpeg"
        ) from exc


def encode_mp3(wav_path: Path, mp3_path: Path, bitrate_kbps: int = 192) -> Path:
    """Encode a WAV to MP3 (mono-safe; input channels are preserved)."""
    cmd = [
        get_ffmpeg_exe(), "-y", "-i", str(wav_path),
        "-b:a", f"{bitrate_kbps}k", str(mp3_path),
    ]
    subprocess.run(cmd, capture_output=True, check=True)
    return mp3_path


# ---------------------------------------------------------------- io
def read_wav(path: str | Path) -> Tuple[np.ndarray, int]:
    """Read a WAV as (float32 mono in [-1,1], sample_rate).

    Multi-channel input is downmixed to mono. 16/24/32-bit PCM and 32-bit
    float are supported.
    """
    path = Path(path)
    with wave.open(str(path), "rb") as wf:
        sr = wf.getframerate()
        ch = wf.getnchannels()
        sw = wf.getsampwidth()
        n = wf.getnframes()
        raw = wf.readframes(n)
    if sw == 2:
        inter = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    elif sw == 3:
        # 24-bit PCM: little-endian, 3 bytes per sample
        n24 = len(raw) // 3
        vals = np.frombuffer(raw[: n24 * 3], dtype=np.uint8).reshape(n24, 3)
        inter = (
            ((vals[:, 2].astype(np.int32) << 16)
             | (vals[:, 1].astype(np.int32) << 8)
             | vals[:, 0].astype(np.int32))
        )
        inter = np.where(inter >= 0x800000, inter - 0x1000000, inter).astype(np.float32) / 8388608.0
    elif sw == 4:
        inter = np.frombuffer(raw, dtype="<f4").astype(np.float32)
    else:
        raise ValueError(f"unsupported WAV sample width: {sw} bytes ({path})")
    if ch > 1:
        inter = inter.reshape(-1, ch).mean(axis=1)
    return np.ascontiguousarray(inter), sr


def write_wav(path: str | Path, arr: np.ndarray, sample_rate: int) -> Path:
    """Write float32 mono in [-1,1] as 16-bit PCM WAV (hard-clamped)."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(arr, -1.0, 1.0) * 32767.0).astype("<i2")
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(int(sample_rate))
        wf.writeframes(pcm.tobytes())
    return path


# ---------------------------------------------------------------- transforms
def resample(arr: np.ndarray, sr_from: int, sr_to: int) -> np.ndarray:
    """Linear-interpolation resample (adequate for speech). No-op if equal.

    Output length is preserved in TIME: out = in * (sr_to / sr_from) samples.
    """
    if sr_from == sr_to or len(arr) == 0:
        return arr
    ratio = sr_to / float(sr_from)  # >1 upsamples, <1 downsamples
    n_out = int(round(len(arr) * ratio))
    if n_out <= 1:
        return arr[:1]
    x = np.arange(n_out) / ratio  # output index -> input position
    xi = np.floor(x).astype(np.int64)
    xc = np.clip(xi + 1, 0, len(arr) - 1)
    frac = (x - xi).astype(np.float32)
    xi = np.clip(xi, 0, len(arr) - 1)
    return arr[xi] * (1.0 - frac) + arr[xc] * frac


def _db_to_linear(db: float) -> float:
    return 10.0 ** (db / 20.0)


def normalize_peak(arr: np.ndarray, target_dbfs: float = -1.0) -> np.ndarray:
    """Scale so the peak hits ``target_dbfs`` (e.g. -1.0 dBFS ≈ 0.891).

    Never amplifies: if the peak is already below the target the array is
    returned unchanged (RMS normalization is the pass that lifts level).
    """
    peak = float(np.max(np.abs(arr))) if len(arr) else 0.0
    if peak <= 1e-6:
        return arr
    gain = min(_db_to_linear(target_dbfs) / peak, 1.0)
    return arr * gain


def normalize_rms(arr: np.ndarray, target_dbfs: float = -16.0) -> np.ndarray:
    """Scale so the RMS hits ``target_dbfs`` (loudness-style, approximate)."""
    rms = float(np.sqrt(np.mean(arr**2))) if len(arr) else 0.0
    if rms <= 1e-6:
        return arr
    gain = _db_to_linear(target_dbfs) / rms
    return arr * gain


def soft_limit(arr: np.ndarray, threshold_dbfs: float = -0.5) -> np.ndarray:
    """Soft-clip samples above ``threshold_dbfs`` with a tanh knee.

    Gentle (no aggressive compression): only peaks above the threshold are
    bent, and the bend saturates at full-scale.
    """
    thr = _db_to_linear(threshold_dbfs)
    if len(arr) == 0 or float(np.max(np.abs(arr))) <= thr:
        return arr
    out = arr.copy()
    over = np.abs(out) > thr
    if not over.any():
        return out
    x = out[over]
    sign = np.sign(x)
    mag = np.abs(x)
    # tanh-shaped overshoot: at |x| = thr the output = thr, then it bends to 1
    bend = thr + (1.0 - thr) * np.tanh((mag - thr) / max(1e-6, (1.0 - thr) * 2.0))
    out[over] = sign * bend
    return out


# ---------------------------------------------------------------- analysis
@dataclass
class Analysis:
    path: str
    ok: bool
    sample_rate: int = 0
    channels: int = 0
    sample_width: int = 0
    duration_s: float = 0.0
    peak_dbfs: float = float("-inf")
    rms_dbfs: float = float("-inf")
    leading_silence_s: float = 0.0
    trailing_silence_s: float = 0.0
    longest_internal_silence_s: float = 0.0
    clipped_samples: int = 0
    all_silence: bool = False
    errors: List[str] = None  # type: ignore[assignment]

    def __post_init__(self):
        if self.errors is None:
            self.errors = []

    def to_dict(self) -> dict:
        return {
            "path": self.path, "ok": self.ok,
            "sample_rate": self.sample_rate, "channels": self.channels,
            "sample_width": self.sample_width, "duration_s": round(self.duration_s, 3),
            "peak_dbfs": round(self.peak_dbfs, 2) if self.peak_dbfs > -1e9 else None,
            "rms_dbfs": round(self.rms_dbfs, 2) if self.rms_dbfs > -1e9 else None,
            "leading_silence_s": round(self.leading_silence_s, 3),
            "trailing_silence_s": round(self.trailing_silence_s, 3),
            "longest_internal_silence_s": round(self.longest_internal_silence_s, 3),
            "clipped_samples": self.clipped_samples,
            "all_silence": self.all_silence,
            "errors": self.errors,
        }


_INF = -1e9


def _silence_runs(arr: np.ndarray, sr: int, threshold: float = 0.008) -> Tuple[float, float, float]:
    """Return (leading_s, trailing_s, longest_internal_s) below ``threshold``."""
    if len(arr) == 0:
        return 0.0, 0.0, 0.0
    active = np.abs(arr) >= threshold
    if not active.any():
        return len(arr) / sr, 0.0, 0.0
    first = int(np.argmax(active))
    last = len(arr) - 1 - int(np.argmax(active[::-1]))
    leading = first / sr
    trailing = (len(arr) - 1 - last) / sr
    # longest internal silent run
    idx = np.where(~active[first:last + 1])[0]
    if idx.size:
        # group consecutive indices
        breaks = np.where(np.diff(idx) != 1)[0] + 1
        groups = np.split(idx, breaks)
        longest = max(len(g) for g in groups) / sr
    else:
        longest = 0.0
    return leading, trailing, longest


def analyze(path: str | Path, silence_threshold: float = 0.008) -> Analysis:
    """Full quality report for one audio file (WAV). Never raises on bad
    files — problems are collected in ``errors`` and ``ok`` is False."""
    path = Path(path)
    a = Analysis(path=str(path), ok=False)
    try:
        with wave.open(str(path), "rb") as wf:
            a.sample_rate = wf.getframerate()
            a.channels = wf.getnchannels()
            a.sample_width = wf.getsampwidth()
            n = wf.getnframes()
            if a.sample_rate <= 0 or n <= 0:
                a.errors.append(f"implausible header (rate={a.sample_rate}, frames={n})")
                return a
            a.duration_s = n / a.sample_rate
            arr, sr = read_wav(path)
    except Exception as e:
        a.errors.append(f"unreadable/corrupt: {e}")
        return a

    a.peak_dbfs = 20 * np.log10(max(1e-9, float(np.max(np.abs(arr)))))
    a.rms_dbfs = 20 * np.log10(max(1e-9, float(np.sqrt(np.mean(arr**2)))))
    a.clipped_samples = int(np.sum(np.abs(arr) >= 0.999))
    a.all_silence = a.rms_dbfs < -50
    a.leading_silence_s, a.trailing_silence_s, a.longest_internal_silence_s = (
        _silence_runs(arr, sr, silence_threshold)
    )
    if a.all_silence:
        a.errors.append("audio is silent (RMS < -50 dBFS)")
    if a.clipped_samples > max(4, int(0.001 * len(arr))):
        a.errors.append(f"significant clipping: {a.clipped_samples} samples at full scale")
    a.ok = len(a.errors) == 0
    return a


def check_file(path: str | Path, expected_duration: Optional[float] = None,
               tolerance: float = 0.35) -> Tuple[bool, List[str]]:
    """Resumability check for a generated segment file: readable, non-silent,
    and (if expected_duration given) duration within tolerance. Used by the
    manifest to decide whether a previous segment can be kept."""
    a = analyze(path)
    if not a.ok:
        return False, a.errors
    if a.duration_s <= 0.05:
        return False, [f"implausibly short: {a.duration_s:.3f}s"]
    if expected_duration is not None:
        if abs(a.duration_s - expected_duration) > max(tolerance, 0.15 * expected_duration):
            return False, [
                f"duration {a.duration_s:.2f}s deviates from expected {expected_duration:.2f}s"
            ]
    return True, []


# ---------------------------------------------------------------- pipeline
def process_audio(
    src: str | Path,
    dst: str | Path,
    resample_rate: Optional[int] = None,
    normalize_peak_dbfs: Optional[float] = None,
    normalize_rms_dbfs: Optional[float] = None,
    limit_dbfs: Optional[float] = None,
) -> Tuple[Analysis, dict]:
    """Apply the standard processing chain to ``src`` and write to ``dst``.

    Order: resample -> peak normalize (if both given, peak first) ->
    RMS normalize -> soft limit. Returns (analysis_of_output, applied_steps).
    The source file is never modified.
    """
    arr, sr = read_wav(src)
    steps: dict = {"sample_rate_in": sr}
    if resample_rate and resample_rate != sr:
        arr = resample(arr, sr, resample_rate)
        sr = resample_rate
        steps["resampled_to"] = sr
    if normalize_peak_dbfs is not None:
        arr = normalize_peak(arr, normalize_peak_dbfs)
        steps["normalize_peak_dbfs"] = normalize_peak_dbfs
    if normalize_rms_dbfs is not None:
        arr = normalize_rms(arr, normalize_rms_dbfs)
        steps["normalize_rms_dbfs"] = normalize_rms_dbfs
    if limit_dbfs is not None:
        before = float(np.max(np.abs(arr))) if len(arr) else 0.0
        arr = soft_limit(arr, limit_dbfs)
        after = float(np.max(np.abs(arr))) if len(arr) else 0.0
        steps["limit_dbfs"] = limit_dbfs
        steps["limit_engaged"] = bool(before > after * 1.0001)
    write_wav(dst, arr, sr)
    return analyze(dst), steps
