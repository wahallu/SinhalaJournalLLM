"""
Sentence chunking for the grammar adapter.

Why this exists
---------------
The grammar LoRA was trained and evaluated on short text only. Measured from
the training and test corpora in `manual dataset/`:

    paragraph.jsonl            max  297 chars   (median 129, max 5 sentences)
    grammar_test_stage2.jsonl  max  106 chars
    grammar_test_stage3.jsonl  max  168 chars
    grammar_test_stage4.jsonl  max  331 chars
    grammar_test_stage5.jsonl  max  289 chars

`train_grammar.py` sets `MAX_SEQ_LENGTH = 512` for prompt *and* completion
combined, so with the ~40-token instruction template the adapter has never
seen an input longer than roughly 230 tokens. The product accepts 10,000
characters — around thirty times the largest example the model was ever
trained on.

Sending a whole article was doing two bad things at once:

  1. `tasks/grammar.py` caps generation at `min(600, prompt_len * 1.5)`
     tokens, so anything past ~600 tokens of output was cut off mid-sentence.
  2. `grammar_service._sanitize_correction()` keeps only the first line, so
     every paragraph after the first was silently discarded.

Splitting the article into sentence-sized pieces, correcting each one inside
the distribution the adapter was actually trained on, and reassembling makes
both problems structurally impossible rather than merely less likely.

Guarantees
----------
Chunks tile the input exactly: `"".join(c.lead + c.text + c.trail)` for the
returned chunks reproduces the original string byte-for-byte. That is what
lets the service rebuild the article with the original paragraph breaks and
spacing intact, and what keeps correction offsets pointing at the right
characters (see `Chunk.start`).
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass

# Sentence-final punctuation actually seen in the corpora. Only "." appears in
# the training data (312 occurrences across the paragraph and test sets; no
# "!" or "?" at all), but real submitted copy has both, and the danda "।" and
# kunddaliya "෴" show up in older Sinhala typography.
_TERMINATORS = ".!?།।෴"

# Tokens ending in "." that must NOT end a sentence. "රු." (rupees) is not
# hypothetical — it appears in grammar_test_stage2.jsonl
# ("ශ්‍රී ලංකාව IMF සමඟ රු. බිලියන 300ක ණය ගිවිසුමකට ලඟාවී ඇත.").
_ABBREVIATIONS = {
    # Sinhala
    "රු", "ඩො", "පෙ.ව", "ප.ව", "අංක", "නො", "මහ", "ආචා", "මහාචා",
    # Latin, for the mixed-script copy this newsroom actually publishes
    "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "st", "vs", "etc",
    "inc", "ltd", "co", "no", "approx", "govt", "dept",
}

_MAX_ABBREV_WORDS = 2  # "පෙ.ව" is two dot-joined pieces


def _letter_count(token: str) -> int:
    """
    Number of written letters in `token`, not codepoints.

    A Sinhala letter is a base character plus any vowel signs, so "බී" is two
    codepoints but one letter. Counting codepoints would make the initial
    "බී." look like a two-letter word and split the sentence there. Combining
    marks (Mn), spacing vowel signs (Mc — which is what most Sinhala vowel
    signs are, and which `unicodedata.combining()` reports as 0) and format
    characters like ZWJ (Cf) all attach to the letter before them.
    """
    return sum(1 for ch in token if unicodedata.category(ch) not in ("Mn", "Mc", "Cf"))


@dataclass(frozen=True)
class Chunk:
    """
    One piece of the input, plus the whitespace that surrounds it.

    `text` is what gets sent to the model — stripped, so the model never sees
    leading or trailing blank space it might "correct". `lead` and `trail`
    carry that whitespace so the article can be rebuilt with its original
    paragraph structure. `start` is the character offset of `text` in the
    original input, which is what correction positions are rebased onto.
    """

    text: str
    start: int
    lead: str = ""
    trail: str = ""

    def rebuild(self, corrected: str) -> str:
        """This chunk's contribution to the reassembled article."""
        return f"{self.lead}{corrected}{self.trail}"


def _is_abbreviation(text: str, dot_index: int) -> bool:
    """
    True when the "." at `dot_index` is part of an abbreviation or a decimal
    rather than a sentence ending.
    """
    # Decimal: digit "." digit, e.g. "2.5" or a version number.
    before = text[dot_index - 1] if dot_index > 0 else ""
    after = text[dot_index + 1] if dot_index + 1 < len(text) else ""
    if before.isdigit() and after.isdigit():
        return True

    # Walk back over the word attached to this dot, allowing interior dots so
    # "පෙ.ව." and "B.B.C." are treated as single tokens.
    start = dot_index
    dots_seen = 0
    while start > 0:
        char = text[start - 1]
        if char.isspace():
            break
        if char == ".":
            dots_seen += 1
            if dots_seen >= _MAX_ABBREV_WORDS:
                break
        start -= 1

    token = text[start:dot_index].strip().lower()
    if not token:
        return False
    if token in _ABBREVIATIONS:
        return True
    # A single letter before the dot is an initial ("A." / "ඒ." / "බී."), not
    # the end of a sentence.
    return _letter_count(token) == 1


def split_sentences(text: str) -> list[tuple[int, str]]:
    """
    Split `text` into (offset, sentence) pairs.

    Sentences keep their terminating punctuation. Offsets are into `text`, and
    the returned spans plus the whitespace between them cover the input with
    no gaps. A blank line ends a sentence even without punctuation, so a
    heading or a list item is not glued onto the paragraph that follows it.
    """
    spans: list[tuple[int, str]] = []
    cursor = 0
    index = 0
    length = len(text)

    while index < length:
        char = text[index]

        if char in _TERMINATORS:
            if char == "." and _is_abbreviation(text, index):
                index += 1
                continue
            # Absorb a run of terminators, so "..." or "?!" stays together.
            end = index + 1
            while end < length and text[end] in _TERMINATORS:
                end += 1
            # Closing quotes and brackets belong to the sentence they end.
            while end < length and text[end] in "\"'”’)]}»":
                end += 1
            # Only a real break if whitespace or end-of-input follows.
            if end >= length or text[end].isspace():
                spans.append((cursor, text[cursor:end]))
                cursor = end
                index = end
                continue
            index = end
            continue

        # Any line break ends a sentence, even without punctuation — a
        # headline, byline or list item is its own unit. This also makes it
        # impossible for a chunk to contain a newline, which matters because
        # grammar_service._sanitize_correction() keeps only the first line of
        # the model's reply: a chunk spanning a line break would silently lose
        # everything after it.
        if char == "\n":
            run_end = index
            while run_end < length and text[run_end] in " \t\r\n":
                run_end += 1
            if text[cursor:index].strip():
                spans.append((cursor, text[cursor:index]))
            cursor = run_end
            index = run_end
            continue

        index += 1

    if cursor < length:
        spans.append((cursor, text[cursor:]))

    return [(offset, body) for offset, body in spans if body.strip()]


def _hard_split(text: str, offset: int, max_chars: int) -> list[tuple[int, str]]:
    """
    Last resort for a single sentence longer than the budget.

    Splitting mid-sentence costs accuracy — the adapter sees a fragment
    without its subject or verb. It is still the better trade: leaving the
    sentence whole means the model server truncates the *output* at 600
    tokens, which loses text outright instead of merely weakening a
    correction. Prefers comma boundaries, falling back to whitespace.
    """
    pieces: list[tuple[int, str]] = []
    remaining = text
    base = offset

    while len(remaining) > max_chars:
        window = remaining[:max_chars]
        cut = max(window.rfind(","), window.rfind("،"), window.rfind(";"))
        if cut <= 0:
            cut = window.rfind(" ")
        if cut <= 0:
            cut = max_chars - 1
        cut += 1
        pieces.append((base, remaining[:cut]))
        base += cut
        remaining = remaining[cut:]

    if remaining:
        pieces.append((base, remaining))
    return pieces


def chunk_text(text: str, max_chars: int) -> list[Chunk]:
    """
    Split `text` into chunks of at most roughly `max_chars`, on sentence
    boundaries wherever possible.

    Sentences are packed together up to the budget rather than sent one at a
    time: each chunk is one model round trip, and the adapter was trained on
    multi-sentence paragraphs (paragraph.jsonl, median 2 sentences), so
    packing is both faster and in-distribution. Chunks never span a paragraph
    break, so a correction can never move text across paragraphs.

    Returns a single chunk covering everything when the input already fits,
    which keeps short input on exactly the same one-call path as before.
    """
    if not text:
        return []

    sentences = split_sentences(text)
    if not sentences:
        return []

    # Expand any sentence that is on its own too large for the budget.
    sized: list[tuple[int, str]] = []
    for offset, body in sentences:
        if len(body.strip()) > max_chars:
            sized.extend(_hard_split(body, offset, max_chars))
        else:
            sized.append((offset, body))

    groups: list[list[tuple[int, str]]] = []
    current: list[tuple[int, str]] = []
    current_len = 0

    for offset, body in sized:
        stripped_len = len(body.strip())
        # Never pack across a line break: it keeps paragraphs independently
        # correctable, and guarantees no chunk contains a newline.
        crosses_line = bool(current) and "\n" in text[
            current[-1][0] + len(current[-1][1]) : offset
        ]
        if current and (current_len + stripped_len > max_chars or crosses_line):
            groups.append(current)
            current, current_len = [], 0
        current.append((offset, body))
        current_len += stripped_len

    if current:
        groups.append(current)

    chunks: list[Chunk] = []
    cursor = 0
    for i, group in enumerate(groups):
        raw_start = group[0][0]
        raw_end = group[-1][0] + len(group[-1][1])
        raw = text[raw_start:raw_end]

        stripped = raw.strip()
        inner_lead = raw[: len(raw) - len(raw.lstrip())]
        inner_trail = raw[len(raw.rstrip()) :]

        # Everything skipped since the previous chunk is whitespace between
        # sentences; it belongs to this chunk's lead so the tiling is exact.
        lead = text[cursor:raw_start] + inner_lead
        trail = inner_trail
        if i == len(groups) - 1:
            trail += text[raw_end:]

        chunks.append(
            Chunk(text=stripped, start=raw_start + len(inner_lead), lead=lead, trail=trail)
        )
        cursor = raw_end

    return chunks
