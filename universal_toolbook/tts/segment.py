"""Text segmentation for natural TTS pacing.

Splits approved script text into segments with explicit pause hints:

* paragraph break (blank line)  -> ``paragraph_pause_s``
* sentence end (. ! ? … —)      -> ``sentence_pause_s``
* clause boundary (, ; :)       -> only used to split OVERLONG sentences

Rules (honoured by design):
* Never splits inside a quoted sentence at a closing quote boundary — a
  closing quote stays attached to the sentence it ends.
* Never splits a sentence shorter than ``max_segment_chars``.
* Keeps an original-text copy on every segment so downstream word timings,
  captions and manifests always show the *approved* spelling.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional

__all__ = ["Segment", "split_text", "load_dictionary", "apply_dictionary"]

_PARA = re.compile(r"\n\s*\n")
_CLAUSE = re.compile(r"(?<=[,;:])\s+")


@dataclass
class Segment:
    index: int
    text: str                      # approved text (never modified)
    tts_text: str                  # text actually sent to the engine
    pause_after: float             # seconds of silence to insert after this segment
    scene_id: Optional[str] = None # set when splitting per-scene
    dictionary_changes: List[str] = field(default_factory=list)

    @property
    def kind(self) -> str:
        return "scene" if self.scene_id is not None else "auto"


def _split_long_sentence(sent: str, max_chars: int) -> List[str]:
    """Split an overlong sentence at clause boundaries (, ; :)."""
    if len(sent) <= max_chars:
        return [sent]
    parts = _CLAUSE.split(sent)
    out: List[str] = []
    cur = ""
    for p in parts:
        if cur and len(cur) + 1 + len(p) > max_chars and len(cur) >= max_chars // 2:
            out.append(cur)
            cur = p
        else:
            cur = f"{cur} {p}" if cur else p
    if cur:
        out.append(cur)
    # if still one giant piece (no clauses), hard-split at word boundary
    final: List[str] = []
    for o in out:
        o = o.strip()
        while len(o) > max_chars * 1.5:
            cut = o.rfind(" ", 0, max_chars)
            if cut < max_chars // 2:
                cut = max_chars
            final.append(o[:cut].strip())
            o = o[cut:].strip()
        if o:
            final.append(o)
    return final or [sent]


def split_text(
    text: str,
    paragraph_pause_s: float = 0.6,
    sentence_pause_s: float = 0.25,
    max_segment_chars: int = 220,
    min_segment_chars: int = 2,
    scene_id: Optional[str] = None,
) -> List[Segment]:
    """Split ``text`` into TTS segments with pause hints.

    When ``scene_id`` is set the WHOLE text is one segment (scene-level
    segmentation for animation sync); sentence splitting is only used for
    free-form scripts.
    """
    text = text.strip()
    if not text:
        return []

    if scene_id is not None:
        segs = _with_dictionary(text)
        return [
            Segment(
                index=0, text=segs[0].text, tts_text=segs[0].tts_text,
                pause_after=0.0, scene_id=scene_id,
                dictionary_changes=segs[0].dictionary_changes,
            )
        ]

    segments: List[Segment] = []
    raw_paras = [p.strip() for p in _PARA.split(text)]
    raw_paras = [p for p in raw_paras if p]

    for pi, para in enumerate(raw_paras):
        # sentence boundaries
        sents = _split_sentences(para)

        last_para = pi == len(raw_paras) - 1
        for si, s in enumerate(sents):
            last_sentence = si == len(sents) - 1
            for piece in _split_long_sentence(s, max_segment_chars):
                if len(piece) < min_segment_chars:
                    continue
                seg = _with_dictionary(piece)[0]
                if last_para and last_sentence:
                    pause = 0.0
                elif not last_para:
                    # every segment after the paragraph's final one would be in
                    # the next paragraph; the paragraph's LAST segment gets the
                    # paragraph pause — applied after the loop below
                    pause = sentence_pause_s
                else:
                    pause = sentence_pause_s
                segments.append(
                    Segment(
                        index=len(segments),
                        text=seg.text,
                        tts_text=seg.tts_text,
                        pause_after=pause,
                        dictionary_changes=seg.dictionary_changes,
                    )
                )
        # paragraph pause after the final segment of each non-final paragraph
        if not last_para:
            segments[-1].pause_after = max(segments[-1].pause_after, paragraph_pause_s)
    return segments


def _split_sentences(para: str) -> List[str]:
    sents: List[str] = []
    buf = ""
    i = 0
    while i < len(para):
        buf += para[i]
        i += 1
        # a sentence ends at . ! ? … followed by whitespace or a newline
        # (scripts are often line-broken mid-paragraph)
        at_boundary = para[i - 1] in ".!?…" and (i >= len(para) or para[i] in " \t\n")
        if at_boundary and buf.strip():
            sents.append(buf.strip())
            buf = ""
    if buf.strip():
        sents.append(buf.strip())
    return sents


def _with_dictionary(piece: str) -> List[Segment]:
    """Apply the pronunciation dictionary if configured (default config)."""
    try:
        from .config import DEFAULT_CONFIG_PATH

        dpath = DEFAULT_CONFIG_PATH.parent / "pronunciation_dictionary.json"
        new_text, changes = apply_dictionary(piece, load_dictionary(dpath))
    except Exception:
        new_text, changes = piece, []
    return [Segment(index=0, text=piece, tts_text=new_text, pause_after=0.0,
                    dictionary_changes=changes)]


# ------------------------------------------------------------------ dictionary
def load_dictionary(path) -> Dict[str, str]:
    import json

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return dict(data.get("entries", {}))


def apply_dictionary(text: str, dictionary: Dict[str, str]) -> tuple[str, List[str]]:
    """Rewrite text for speech using the dictionary.

    * word-boundary matching (``\\b``), case-insensitive
    * the ORIGINAL spelling is untouched — the caller keeps it in
      ``Segment.text``; only ``tts_text`` is rewritten
    * never changes meaning: entries are plain pronunciation substitutes

    Returns (new_text, list_of_applied_rules) where each rule is
    ``"term -> spoken"``.
    """
    if not dictionary:
        return text, []
    applied: List[str] = []
    out = text
    # longest terms first so "CI/CD" wins over any single-letter rule
    for term in sorted(dictionary, key=len, reverse=True):
        spoken = dictionary[term]
        if not term or term == spoken:
            continue
        pattern = re.compile(r"\b" + re.escape(term) + r"\b", re.IGNORECASE)

        def _sub(m, spoken=spoken, term=term):
            applied.append(f"{m.group(0)} -> {spoken}")
            return spoken

        out = pattern.sub(_sub, out)
    return out, applied
