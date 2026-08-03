"""
Sentence chunking for the grammar adapter.

The adapter was trained on text up to ~330 characters (measured across
paragraph.jsonl and grammar_test_stage2-5.jsonl) with MAX_SEQ_LENGTH=512,
while the product accepts 10,000. Chunking keeps every model call inside the
distribution the adapter was actually trained on.

The property that matters most is exact reconstruction: if every chunk comes
back unchanged, reassembling them must reproduce the input byte-for-byte.
Anything less means the grammar checker silently edits whitespace and
paragraph structure it was never asked to touch.
"""

import pytest

from app.services.grammar.chunking import Chunk, chunk_text, split_sentences

_S1 = "ශ්‍රී ලංකා කණ්ඩායම ජය ගත්තා."
_S2 = "තරඟය කොළඹදී පැවැත්විණි."
_S3 = "ප්‍රේක්ෂකයෝ බොහෝ දෙනෙක් පැමිණියහ."


def _rebuilt(text: str, max_chars: int) -> str:
    """Reassemble with every chunk returned unchanged."""
    return "".join(c.rebuild(c.text) for c in chunk_text(text, max_chars))


# ── Exact reconstruction ──

@pytest.mark.parametrize(
    "text",
    [
        _S1,
        f"{_S1} {_S2}",
        f"{_S1}\n{_S2}",
        f"{_S1}\n\n{_S2}\n\n{_S3}",
        f"  {_S1}  {_S2}  ",
        f"{_S1}\n\n\n{_S2}\n",
        "අවසන් තිත නැති වාක්‍යයක්",
        f"{_S1} {_S2} {_S3} {_S1} {_S2} {_S3}",
    ],
)
@pytest.mark.parametrize("max_chars", [20, 60, 300, 10000])
def test_unchanged_chunks_rebuild_the_input_exactly(text, max_chars):
    assert _rebuilt(text, max_chars) == text


def test_start_offsets_point_at_the_chunk_text_in_the_original():
    """Correction positions are rebased on these — they must be exact."""
    text = f"{_S1}\n\n{_S2} {_S3}"
    for chunk in chunk_text(text, 60):
        assert text[chunk.start : chunk.start + len(chunk.text)] == chunk.text


# ── Splitting behaviour ──

def test_short_input_stays_a_single_call():
    """Anything already inside the budget must not change behaviour at all."""
    chunks = chunk_text(f"{_S1} {_S2}", 300)
    assert len(chunks) == 1
    assert chunks[0].text == f"{_S1} {_S2}"


def test_long_input_is_split_on_sentence_boundaries():
    text = " ".join([_S1, _S2, _S3])
    chunks = chunk_text(text, 40)
    assert len(chunks) > 1
    # Every chunk ends at a real sentence ending, never mid-sentence.
    for chunk in chunks:
        assert chunk.text.endswith(".")


def test_sentences_are_packed_up_to_the_budget():
    """One round trip per chunk, so pack rather than send one sentence each."""
    text = " ".join([_S1, _S2, _S3])
    chunks = chunk_text(text, 10_000)
    assert len(chunks) == 1


def test_chunks_never_span_a_paragraph_break():
    """A correction must not be able to move text between paragraphs."""
    text = f"{_S1}\n\n{_S2}"
    chunks = chunk_text(text, 10_000)
    assert len(chunks) == 2
    assert chunks[0].text == _S1
    assert chunks[1].text == _S2


def test_blank_line_separates_even_without_punctuation():
    """Headings and list items have no full stop but are still their own unit."""
    text = f"ප්‍රධාන පුවත\n\n{_S1}"
    chunks = chunk_text(text, 10_000)
    assert [c.text for c in chunks] == ["ප්‍රධාන පුවත", _S1]


@pytest.mark.parametrize(
    "text",
    [
        f"ප්‍රධාන පුවත\n{_S1}",
        f"{_S1}\n{_S2}\n{_S3}",
        f"{_S1}\n\n{_S2}",
        f"පේළිය එක\nපේළිය දෙක\nපේළිය තුන",
    ],
)
@pytest.mark.parametrize("max_chars", [30, 300, 10_000])
def test_no_chunk_ever_contains_a_newline(text, max_chars):
    """
    Load-bearing guarantee: grammar_service._sanitize_correction() keeps only
    the first line of the model's reply, so a chunk spanning a line break
    would silently lose everything after it.
    """
    for chunk in chunk_text(text, max_chars):
        assert "\n" not in chunk.text


# ── False sentence endings ──

def test_rupee_abbreviation_does_not_end_a_sentence():
    """`රු.` appears in grammar_test_stage2.jsonl — a real case, not a hypothetical."""
    text = "ශ්‍රී ලංකාව IMF සමඟ රු. බිලියන 300ක ණය ගිවිසුමකට ළඟාවී ඇත."
    assert [c.text for c in chunk_text(text, 10_000)] == [text]
    assert len(split_sentences(text)) == 1


def test_decimals_do_not_end_a_sentence():
    text = "ආර්ථික වර්ධනය 2.5 ක් විය."
    assert len(split_sentences(text)) == 1


def test_initials_do_not_end_a_sentence():
    text = "ඒ. බී. පෙරේරා මහතා පැමිණියේය."
    assert len(split_sentences(text)) == 1


def test_latin_titles_do_not_end_a_sentence():
    text = "Dr. Silva ශ්‍රී ලංකාවට පැමිණියේය."
    assert len(split_sentences(text)) == 1


def test_ellipsis_stays_with_its_sentence():
    text = f"ඔහු කීවේ… {_S2}"
    assert _rebuilt(text, 10_000) == text


# ── Oversized single sentence ──

def test_a_single_oversized_sentence_is_still_split():
    """
    Splitting mid-sentence costs accuracy, but leaving it whole means the
    model server truncates the *output* at 600 tokens — losing text outright.
    """
    long_sentence = "වචන " * 200 + "අවසානයි."
    chunks = chunk_text(long_sentence, 100)
    assert len(chunks) > 1
    assert all(len(c.text) <= 120 for c in chunks)
    assert _rebuilt(long_sentence, 100) == long_sentence


# ── Edge cases ──

@pytest.mark.parametrize("text", ["", "   ", "\n\n"])
def test_blank_input_produces_no_chunks(text):
    assert chunk_text(text, 300) == []


def test_chunk_rebuild_applies_the_correction():
    chunk = Chunk(text="වැරදි", start=2, lead="  ", trail="\n")
    assert chunk.rebuild("නිවැරදි") == "  නිවැරදි\n"
