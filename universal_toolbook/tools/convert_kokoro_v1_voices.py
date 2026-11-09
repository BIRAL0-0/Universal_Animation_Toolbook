#!/usr/bin/env python3
"""Torch-free decoder for Kokoro v1.0 voice files (``.pt`` single-tensor pickles).

The official Kokoro v1.0 voice set ships as PyTorch tensor pickles
(``torch.save(tensor, file)`` format — a ZIP containing ``data.pkl``, a
``byteorder`` marker, and a raw ``data/0`` float32 buffer). This module
decodes that format with only the standard library + numpy, so the toolbook
can integrate v1.0 voices without installing PyTorch (whose wheels pull
multi-GB CUDA dependencies we do not want in the repo environment).

Each voice is a style-vector tensor of shape ``(510, 1, 256)`` float32 —
the same shape kokoro-onnx loads from ``voices.npz`` (v0.19 files use
``(511, 1, 256)``; the one-row difference is absorbed by kokoro-onnx's
``_style_for`` clamping, and v1.0 vectors are verified to synthesize
correctly on the v0.19 int8 model).

Usage (library, e.g. from setup_tts.py):

    from tools.convert_kokoro_v1_voices import decode_voice_tensor, build_v1_voices_npz
    arr = decode_voice_tensor(open("af_heart.pt", "rb").read())      # (510,1,256) f32
    build_v1_voices_npz({name: bytes, ...}, "/path/to/voices-v1.0-en.npz")

Usage (CLI):

    python3 universal_toolbook/tools/convert_kokoro_v1_voices.py \\
        --pt-dir /tmp/v1pts --out cache/tts/voices-v1.0-en.npz
"""

from __future__ import annotations

import argparse
import io
import re
import zipfile
from pathlib import Path
from typing import Dict, Iterable

import numpy as np

#: Expected style-vector shape for Kokoro v1.0 voices (128-dim x 4 = 510 rows
#: for 4-phoneme windows up to MAX_PHONEME_LENGTH). All 33 English v1.0
#: voices share it; the decoder verifies rather than assumes.
EXPECTED_SHAPE = (510, 1, 256)

_NAME_RE = re.compile(r"^[a-z]{2}_[a-z0-9_]+$")


def _entry(names: list[str], suffix: str) -> str:
    """First archive entry whose name ends with ``suffix``.

    The in-archived prefix is NOT always the voice name (e.g. the community
    "inno" files store ``amelia_earhart/...`` inside ``af_amelia_inno.pt``),
    so match by suffix only.
    """
    for n in names:
        if n.endswith(suffix):
            return n
    raise ValueError(f"no entry ending with {suffix!r} in {names}")


def decode_voice_tensor(data: bytes) -> np.ndarray:
    """Decode one ``torch.save(tensor)`` .pt file into a numpy array.

    Returns the float32 style vector reshaped to ``(510, 1, 256)``.
    Raises ``ValueError`` if the layout is unexpected or the values are
    non-finite / degenerate.
    """
    try:
        z = zipfile.ZipFile(io.BytesIO(data))
    except zipfile.BadZipFile as e:
        raise ValueError("not a torch .pt (zip) file") from e
    names = z.namelist()
    if not any(n.endswith("data/0") for n in names):
        raise ValueError(f"no raw data entry in {names}")

    raw = z.read(_entry(names, "data/0"))
    bo_names = [n for n in names if n.endswith("byteorder")]
    bo = z.read(bo_names[0]).decode().strip() if bo_names else "little"
    arr = np.frombuffer(raw, dtype="<f4" if bo == "little" else ">f4")

    if arr.size != int(np.prod(EXPECTED_SHAPE)):
        raise ValueError(f"unexpected tensor size {arr.size} (expected {int(np.prod(EXPECTED_SHAPE))})")
    arr = arr.reshape(EXPECTED_SHAPE).astype(np.float32, copy=False)
    if not np.isfinite(arr).all():
        raise ValueError("non-finite values in style vector")
    if float(arr.std()) < 0.01:
        raise ValueError("degenerate (constant) style vector")
    return np.ascontiguousarray(arr)


def build_v1_voices_npz(pt_bytes: Dict[str, bytes], out_path: str | Path) -> list[str]:
    """Decode many .pt bytes and write one npz. Returns the sorted voice names."""
    arrays: Dict[str, np.ndarray] = {}
    for name, data in pt_bytes.items():
        if not _NAME_RE.match(name):
            raise ValueError(f"invalid voice name {name!r}")
        arrays[name] = decode_voice_tensor(data)
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    np.savez(out, **arrays)
    # sanity: reload
    with np.load(out) as check:
        if set(check.files) != set(arrays):
            raise ValueError(f"npz round-trip mismatch: {sorted(check.files)}")
    return sorted(arrays)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pt-dir", required=True, help="directory of *.pt voice files (filename = voice name)")
    ap.add_argument("--out", required=True, help="output .npz path")
    args = ap.parse_args()

    pt_dir = Path(args.pt_dir)
    pt_bytes = {p.stem: p.read_bytes() for p in sorted(pt_dir.glob("*.pt"))}
    if not pt_bytes:
        raise SystemExit(f"no .pt files in {pt_dir}")
    names = build_v1_voices_npz(pt_bytes, args.out)
    print(f"{len(names)} voices -> {args.out}")
    for n in names:
        print(f"  {n}")


if __name__ == "__main__":
    main()
