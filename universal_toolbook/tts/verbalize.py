"""Spoken-form verbalization: the missing half of the display/spoken split.

The film render path had exactly one string per dialogue line (``dialogue[].text``),
and it fed **both** the TTS engine and the subtitles. VOICEOVER_POLISH_PROMPT rules 5-7
therefore forced authors to hand-write the spoken form into the script --
``"takes twenty one days"`` -- which then appeared, spelled out, in the burned-in
subtitle next to a board that reads ``21 days``. Two registers of the same fact on one
screen is the defect this module exists to remove.

The contract here:

* ``text``      the authored, natural, *written* form. Subtitles show this. Never rewritten.
* ``spoken``    what the engine actually says. Derived deterministically from ``text``.

``verbalize()`` returns both, plus a token alignment that lets the subtitle builder map
every displayed token onto the exact spoken words that voice it -- so subtitle glow stays
frame-accurate even though ``254`` became five spoken words.

Rules implemented (VOICEOVER_POLISH_PROMPT 5-7):

* numbers, decimals, ordinals, thousands separators
* years in context (``1927`` -> "nineteen twenty seven"), else cardinal
* dates (``7 Nov 2076`` -> "the seventh of November twenty seventy six")
* clock times (``9 PM`` -> "nine in the evening")
* ranges (``40-90`` -> "forty to ninety"), multipliers (``1.5x`` -> "one and a half times")
* symbols: ``%`` ``$`` ``&`` ``+`` ``#`` ``=`` ``→`` ``/``
* acronyms and technical terms via ``config/pronunciation_dictionary.json``

Anything already written in its spoken form passes through untouched, so the module is
idempotent and applying it to an existing script never changes the audio.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Tuple

__all__ = [
    "spell_number",
    "spell_year",
    "verbalize_token",
    "verbalize",
    "Verbalized",
    "TokenAlignment",
    "load_dictionary",
    "unvoiceable_tokens",
]

DICTIONARY_PATH = Path(__file__).resolve().parent / "config" / "pronunciation_dictionary.json"

_ONES = (
    "zero one two three four five six seven eight nine ten eleven twelve thirteen "
    "fourteen fifteen sixteen seventeen eighteen nineteen"
).split()
_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()
_SCALES = ("", "thousand", "million", "billion", "trillion", "quadrillion")

_MONTHS = {
    "jan": "January", "january": "January",
    "feb": "February", "february": "February",
    "mar": "March", "march": "March",
    "apr": "April", "april": "April",
    "may": "May",
    "jun": "June", "june": "June",
    "jul": "July", "july": "July",
    "aug": "August", "august": "August",
    "sep": "September", "sept": "September", "september": "September",
    "oct": "October", "october": "October",
    "nov": "November", "november": "November",
    "dec": "December", "december": "December",
}

_ORDINAL_IRREGULAR = {
    "one": "first", "two": "second", "three": "third", "five": "fifth",
    "eight": "eighth", "nine": "ninth", "twelve": "twelfth",
}

_ORDINAL_UNITS = {
    "zero": "zeroth", "four": "fourth", "six": "sixth", "seven": "seventh",
    "ten": "tenth", "eleven": "eleventh", "thirteen": "thirteenth",
    "fourteen": "fourteenth", "fifteen": "fifteenth", "sixteen": "sixteenth",
    "seventeen": "seventeenth", "eighteen": "eighteenth", "nineteen": "nineteenth",
}

_CURRENCY = {"$": ("dollar", "dollars"), "£": ("pound", "pounds"), "€": ("euro", "euros")}

_MONTHS_FULL = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)

# Words that, immediately before a four-digit number, mean it is a year not a count.
_YEAR_LEAD = {
    "in", "since", "by", "until", "till", "before", "after", "during", "of", "from",
    "year", "circa", "around", "mid", "early", "late", "back", "and", "the", "to",
}

# A token we cannot read aloud is a script defect, not something to paper over.
_UNVOICEABLE = re.compile(r"[%$£€&+#@*=~^|\\<>\[\]{}]|→|->")


# --------------------------------------------------------------------------- numbers


def _under_1000(n: int) -> str:
    out: List[str] = []
    if n >= 100:
        out.append(f"{_ONES[n // 100]} hundred")
        n %= 100
        if n:
            out.append("and")
    if n:
        if n < 20:
            out.append(_ONES[n])
        else:
            tens, ones = divmod(n, 10)
            out.append(_TENS[tens] + (f" {_ONES[ones]}" if ones else ""))
    return " ".join(out) or "zero"


def spell_number(n: int) -> str:
    """Cardinal words in British style: 254 -> "two hundred and fifty four"."""
    n = int(n)
    if n < 0:
        return "minus " + spell_number(-n)
    if n < 1000:
        return _under_1000(n)
    groups: List[Tuple[int, int]] = []
    scale = 0
    while n > 0:
        n, rem = divmod(n, 1000)
        if rem:
            groups.append((rem, scale))
        scale += 1
    parts: List[str] = []
    for idx, (value, sc) in enumerate(reversed(groups)):
        chunk = _under_1000(value)
        if sc:
            chunk = f"{chunk} {_SCALES[sc]}"
        parts.append(chunk)
    # British usage keeps a single "and" before a trailing sub-hundred remainder.
    if len(parts) > 1 and groups[0][1] == 0 and groups[0][0] < 100:
        return " ".join(parts[:-1]) + " and " + parts[-1].replace("and ", "", 1)
    return " ".join(parts)


def _pair_words(hi: int, lo: int) -> str:
    """Read a two-digit chunk the way years and codenames are spoken."""
    if lo == 0:
        return _under_1000(hi * 100)
    if lo < 10:
        return f"{_under_1000(hi)} oh {_ONES[lo]}"
    return f"{_under_1000(hi)} {_under_1000(lo)}"


def spell_year(n: int) -> str:
    """1927 -> "nineteen twenty seven", 2076 -> "twenty seventy six", 2005 -> "two thousand and five"."""
    if 2000 < n < 2100:
        hi, lo = divmod(n, 100)
        return _pair_words(hi, lo) if lo else f"{_under_1000(hi)} hundred"
    if 1000 <= n <= 1999:
        return _pair_words(n // 100, n % 100)
    if 2000 <= n <= 2099:
        return "two thousand" + (f" and {_under_1000(n - 2000)}" if n > 2000 else "")
    return spell_number(n)


def spell_decimal(text: str) -> str:
    """"1.5" -> "one point five"; "3.75" -> "three point seven five"."""
    whole, frac = text.split(".", 1)
    whole_words = spell_number(int(whole)) if whole else "zero"
    frac_words = " ".join(_ONES[int(d)] for d in frac if d.isdigit())
    return f"{whole_words} point {frac_words}".strip()


def spell_ordinal(n: int) -> str:
    word = spell_number(n)
    head, _, last = word.rpartition(" ")
    tail = _ORDINAL_IRREGULAR.get(last) or _ORDINAL_UNITS.get(last)
    if tail is None:
        if last.endswith("y"):
            tail = last[:-1] + "ieth"
        else:
            tail = last + "th"
    return f"{head} {tail}".strip()


def _spell_version_tail(digits: str) -> str:
    """Three-digit tails in names read as pairs, not hundreds: 264 -> "two sixty four"."""
    if len(digits) == 3 and digits[0] != "0":
        return _pair_words(int(digits[0]), int(digits[1:]))
    return spell_number(int(digits))


# --------------------------------------------------------------------------- helpers


def _strip(token: str) -> Tuple[str, str, str]:
    """Split a display token into (leading punctuation, core, trailing punctuation)."""
    m = re.match(r"^([^\w$£€]*)(.*?)([^\w%]*)$", token, re.UNICODE)
    if not m:
        return "", token, ""
    return m.group(1), m.group(2), m.group(3)


def _split_ws(text: str) -> List[str]:
    """Whitespace tokens of the authored text, preserving the author's own spacing.

    No re-punctuation happens here: the spoken string must differ from the written
    string only where a rule actually fired, so a diff between the two is meaningful.
    """
    if not text:
        return []
    stripped = text.strip()
    return stripped.split() if stripped else []


def load_dictionary(path: Optional[Path] = None) -> Dict[str, str]:
    """Case-insensitive map of written token -> spoken spelling."""
    p = Path(path) if path else DICTIONARY_PATH
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return {str(k): str(v) for k, v in (data.get("entries") or {}).items()}


def _dictionary_lookup(core: str, dictionary: Dict[str, str]) -> Optional[str]:
    if not dictionary:
        return None
    if core in dictionary:
        return dictionary[core]
    low = core.lower()
    for term, spoken in dictionary.items():
        if term.lower() == low:
            return spoken
    return None


# --------------------------------------------------------------------------- token rules


def _is_month(token: str) -> bool:
    return _strip(token)[1].lower() in _MONTHS


def verbalize_token(
    core: str,
    prev_core: str = "",
    next_core: str = "",
    dictionary: Optional[Dict[str, str]] = None,
) -> Optional[str]:
    """Spoken form of one token's core, or ``None`` when it is already speakable as written."""
    dictionary = dictionary or {}
    if not core:
        return None

    spoken = _dictionary_lookup(core, dictionary)
    if spoken is not None:
        return spoken

    low = core.lower()

    # -- month names and abbreviations always read as their full spoken form
    #    ("Nov" -> "November"); this also covers the middle of a slashed date.
    if low in _MONTHS:
        return _MONTHS[low]

    # -- clock time. Only a DIGIT hour needs help: backends read "3 AM" correctly,
    #    but "9 PM" risks "nine P M". Leaving spelled-out hours alone keeps the module
    #    idempotent, so re-running it over an already-correct script changes nothing.
    if low in ("am", "a.m.", "a.m") and prev_core.isdigit():
        return "in the morning"
    if low in ("pm", "p.m.", "p.m") and prev_core.isdigit():
        return "in the evening"

    # -- dates: "7" immediately before a month name becomes an ordinal day.
    if core.isdigit() and _is_month(next_core):
        return f"the {spell_ordinal(int(core))} of"

    # -- month-first dates: "Nov 7" reads "November seventh" (days only, never years).
    if core.isdigit() and _is_month(prev_core) and 1 <= int(core) <= 31:
        return spell_ordinal(int(core))

    # -- slashed dates: 7/nov/2076 maps month cores to their full name.
    if low in _MONTHS and "/" in low:
        return _MONTHS[low]

    # -- ordinals: 1st, 21st, 3rd, 12th
    m = re.fullmatch(r"(\d+)(st|nd|rd|th)", low)
    if m:
        return spell_ordinal(int(m.group(1)))

    # -- names with a version tail: H.264, H.265
    m = re.fullmatch(r"([A-Za-z])\.(\d+)", core)
    if m:
        return f"{m.group(1)} {_spell_version_tail(m.group(2))}"

    m = re.fullmatch(r"([A-Za-z])(\d{2,})", core)
    if m:
        return f"{m.group(1)} {_spell_version_tail(m.group(2))}"

    # -- decimals: 1.5, 0.25
    if re.fullmatch(r"\d+\.\d+", core):
        return spell_decimal(core)

    # -- plain integers (digits with optional thousands separators)
    if re.fullmatch(r"\d{1,3}(?:,\d{3})+|\d+", core):
        n = int(core.replace(",", ""))
        is_yearish = len(core) == 4 and core.isdigit() and n > 1100
        if is_yearish and prev_core.lower() in _YEAR_LEAD:
            return spell_year(n)
        # "7 Nov 2076" -- a four-digit number two tokens after a month is the year.
        if is_yearish and _is_month(prev_core):
            return spell_year(n)
        return spell_number(n)

    # -- lone symbols that are spoken as words
    if core == "&":
        return "and"
    if core == "+":
        return "plus"
    if core == "#":
        return "number"
    if core == "=":
        return "equals"
    if core == "→":
        return "leads to"
    if core == "@":
        return "at"

    return None


# --------------------------------------------------------------------------- alignment


@dataclass
class TokenAlignment:
    """One display token and the spoken words that voice it."""

    raw: str                 # exactly as it will be drawn in the subtitle
    spoken: str              # spoken replacement ("" when the token is punctuation-only)
    word_start: int = 0      # inclusive index into Verbalized.words
    word_end: int = 0        # exclusive

    def as_dict(self) -> Dict[str, object]:
        return {"raw": self.raw, "w0": self.word_start, "w1": self.word_end}


@dataclass
class Verbalized:
    text: str                               # authored / displayed form, unchanged
    spoken: str                             # what the engine says
    words: List[str] = field(default_factory=list)       # spoken words, in order
    tokens: List[TokenAlignment] = field(default_factory=list)
    rules: List[str] = field(default_factory=list)       # "19 -> nineteen", for the audit trail

    @property
    def changed(self) -> bool:
        return bool(self.rules)

    def as_alignment(self) -> List[Dict[str, object]]:
        return [t.as_dict() for t in self.tokens]


def _verbalize_compound(
    core: str, prev_core: str, next_core: str, dictionary: Dict[str, str]
) -> Optional[str]:
    """Multi-part tokens: ranges, multipliers, percentages, currency."""
    # percentages: 20% / 20 % was split already, so this is the attached form
    m = re.fullmatch(r"(\d+(?:\.\d+)?)%", core)
    if m:
        number = spell_decimal(m.group(1)) if "." in m.group(1) else spell_number(int(m.group(1)))
        return f"{number} percent"

    # multipliers: 1.5x, 3x
    m = re.fullmatch(r"(\d+(?:\.\d+)?)\s*[x×]", core, re.IGNORECASE)
    if m:
        number = spell_decimal(m.group(1)) if "." in m.group(1) else spell_number(int(m.group(1)))
        if m.group(1).endswith(".5"):
            return f"{number.replace(' point five', ' and a half')} times"
        return f"{number} times"

    # ranges: 40-90, 18–254
    m = re.fullmatch(r"(\d+)\s*[-–—]\s*(\d+)", core)
    if m:
        return f"{spell_number(int(m.group(1)))} to {spell_number(int(m.group(2)))}"

    # currency prefixes: $5
    m = re.fullmatch(r"([$£€])(\d+(?:\.\d+)?)", core)
    if m:
        unit_single, unit_plural = _CURRENCY[m.group(1)]
        amount = m.group(2)
        number = spell_decimal(amount) if "." in amount else spell_number(int(amount))
        unit = unit_single if amount in ("1", "1.0") else unit_plural
        return f"{number} {unit}"

    # slashed / hyphenated dates: 7/nov/2076, 7-Nov-2076, 7/11/2076
    parts = re.split(r"[/-]", core)
    if len(parts) == 3 and all(parts):
        day, month, year = parts
        month_name = _MONTHS.get(month.lower())
        if day.isdigit() and year.isdigit() and len(year) in (2, 4):
            spoken_year = spell_year(int(year)) if len(year) == 4 else spell_number(int(year))
            if month_name:
                return f"the {spell_ordinal(int(day))} of {month_name} {spoken_year}"
            if month.isdigit():
                return (
                    f"the {spell_ordinal(int(day))} of "
                    f"{_MONTHS_FULL[int(month) - 1]} {spoken_year}"
                )

    return None


def verbalize(text: str, dictionary: Optional[Dict[str, str]] = None) -> Verbalized:
    """Return display text, spoken text, and the token alignment between them.

    ``text`` is never modified. Callers that only need the audio string can read
    ``.spoken``; the subtitle builder needs ``.tokens`` to keep glow sync exact.
    """
    dictionary = load_dictionary() if dictionary is None else dictionary
    raw_tokens = _split_ws(text)
    alignments: List[TokenAlignment] = []
    spoken_parts: List[str] = []
    words: List[str] = []
    rules: List[str] = []
    cursor = 0
    cores = [_strip(t)[1] for t in raw_tokens]

    for i, raw in enumerate(raw_tokens):
        lead, core, trail = _strip(raw)
        prev_core = cores[i - 1] if i > 0 else ""
        next_core = cores[i + 1] if i + 1 < len(cores) else ""

        replacement = _verbalize_compound(core, prev_core, next_core, dictionary)
        if replacement is None:
            replacement = verbalize_token(core, prev_core, next_core, dictionary)

        if replacement is None:
            spoken_piece = core
            # A month token keeps its own spelling; nothing to change.
        else:
            spoken_piece = replacement
            # Preserve sentence-initial capitalization, which is a real prosody cue: a line
            # opening "5 weeks early" must be spoken "Five weeks early". An ALL-CAPS token
            # (TTS, GPU) stays the dictionary's lower-case expansion, since a capitalised
            # acronym expansion would read as "Text to speech" and change the emphasis.
            # A token is capitalized only when the author marked it so: either the token
            # itself began with a capital (`Five weeks` -> `Five weeks`), or it follows
            # sentence punctuation. A bare numeral carries no case information, so a line
            # that OPENS with one stays lower case -- that keeps the spoken register
            # deterministic instead of guessing from a fragment.
            after_sentence_end = i > 0 and bool(re.search(r"[.!?—]\s*$", raw_tokens[i - 1]))
            author_capitalized = core[:1].isupper() and i == 0
            if (
                (after_sentence_end or author_capitalized)
                and spoken_piece[:1].islower()
                and not (core.isupper() and len(core) > 1)
            ):
                spoken_piece = spoken_piece[:1].upper() + spoken_piece[1:]
            if spoken_piece != core:
                rules.append(f"{core} -> {spoken_piece}")

        # Punctuation-only tokens (like a bare em dash) voice nothing.
        if not core:
            spoken_piece = ""

        spoken_word_list = spoken_piece.split() if spoken_piece else []
        piece_with_punct = f"{lead}{spoken_piece}{trail}" if spoken_piece else raw

        spoken_parts.append(piece_with_punct)
        w0 = cursor
        words.extend(spoken_word_list)
        cursor += len(spoken_word_list)
        alignments.append(TokenAlignment(raw=raw, spoken=spoken_piece, word_start=w0, word_end=cursor))

    # A date reads "the seventh of November", which needs the day and month joined
    # smoothly; joining on single spaces already achieves that.
    spoken = " ".join(p for p in spoken_parts if p)
    return Verbalized(text=text, spoken=spoken, words=words, tokens=alignments, rules=rules)


def unvoiceable_tokens(text: str) -> List[str]:
    """Symbols the verbalizer cannot turn into speech -- a rule-5 script defect."""
    return sorted({m.group(0) for m in _UNVOICEABLE.finditer(text or "")})
