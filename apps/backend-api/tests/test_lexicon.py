"""
Frequency-based spelling suggestions.

The grammar model memorises word forms — it fixes a word it was taught 68% of
the time and one it never saw 26%, unchanged across v22/v23/v24. The lexicon
covers part of that residue because it has nothing to memorise: it only compares
how common two spellings are in real published Sinhala.

The properties worth protecting are that it stays quiet on correct text, that it
never edits anything, and that it degrades to silence rather than failing a
grammar request.
"""

import pytest

from app.services.grammar import lexicon
from app.services.grammar.lexicon import (
    Suggestion,
    _doubled_candidates,
    _dropped_vowel_candidates,
    _swap_candidates,
    check,
)


# ── Candidate generation: three distinct error shapes ──

def test_swap_reaches_confusable_letters():
    """කෙරුනි -> කෙරුණි is one න/ණ swap."""
    assert "කෙරුණි" in _swap_candidates("කෙරුනි")


def test_swap_reaches_two_changes_at_once():
    """පරීක්ශන -> පරීක්ෂණ needs ශ->ෂ AND න->ණ together."""
    assert "පරීක්ෂණ" in _swap_candidates("පරීක්ශන")


def test_doubled_letter_deletion():
    """මියගගොස් -> මියගොස්: a repeated letter, which no swap can reach."""
    assert "මියගොස්" in _doubled_candidates("මියගගොස්")
    assert "මියගොස්" not in _swap_candidates("මියගගොස්")


def test_dropped_vowel_sign_restored():
    """මෙහදී -> මෙහිදී is a missing ි — neither a swap nor a repetition."""
    assert "මෙහිදී" in _dropped_vowel_candidates("මෙහදී")
    assert "මෙහිදී" not in _swap_candidates("මෙහදී")
    assert "මෙහිදී" not in _doubled_candidates("මෙහදී")


def test_candidates_never_include_the_word_itself():
    for gen in (_swap_candidates, _doubled_candidates, _dropped_vowel_candidates):
        assert "කෙරුණි" not in gen("කෙරුණි")


# ── Behaviour against the real shipped lexicon ──

def _lexicon_available():
    return bool(lexicon._lexicon())


needs_lexicon = pytest.mark.skipif(
    not _lexicon_available(), reason="sinhala_lexicon.txt.gz not present"
)


@needs_lexicon
@pytest.mark.parametrize(
    "sentence,wrong,right",
    [
        ("අපරාධ පරීක්ශන දෙපාර්තමේන්තුවේ නිලධාරීන් පැමිණියා.", "පරීක්ශන", "පරීක්ෂණ"),
        ("රියදුරු බන්දුල රත්නායක මියගගොස් ඇති බව සඳහන් කෙරුණි.", "මියගගොස්", "මියගොස්"),
        ("වැරදිකරු බවට තීරණය කෙරුනි.", "කෙරුනි", "කෙරුණි"),
    ],
)
def test_flags_words_the_model_leaves_wrong(sentence, wrong, right):
    """Each of these is a correction v22 failed to make on stage4/stage5."""
    hits = check(sentence)
    assert any(h.original == wrong and h.suggestion == right for h in hits), hits


@needs_lexicon
@pytest.mark.parametrize(
    "sentence",
    [
        "රඛිත රාජපක්ෂ මහතා සහ චරිත් අබේසිංහ මහතා අල්ලස් හෝ දූෂණ විමර්ශන කොමිසමේ නිලධාරීන් විසින් අත්අඩංගුවට ගෙන තිබුණි.",
        "සැකකරුවන් ගම්පොල මහෙස්ත්‍රාත් අධිකරණය වෙත ඉදිරිපත් කිරීමට නියමිතය.",
        "ශ්‍රී ලංකා ක්‍රිකට් කණ්ඩායම ඊයේ පැවති තරඟයෙන් ජයග්‍රහණයක් වාර්තා කළේය.",
    ],
)
def test_stays_silent_on_correct_text(sentence):
    """A wrong flag costs a journalist's attention on every article."""
    assert check(sentence) == []


@needs_lexicon
@pytest.mark.parametrize(
    "correct,misspelling",
    [
        ("තරඟයෙන්", "තරගයෙන්"),   # ITN: 88x correct vs 681x wrong, before folding
        ("තරඟය", "තරගය"),         # 582x vs 4470x
        ("බරපතළ", "බරපතල"),       # 764x vs 2000x
        ("නිලධාරිණියක", "නිලධාරිනියක"),  # 0x vs 52x
    ],
)
def test_never_suggests_a_known_misspelling(correct, misspelling):
    """
    Regression: counted straight off the corpus, this suggested the WRONG
    spelling for each of these, because ITN publishes the error more often than
    the correct form. build_lexicon.py folds the misspelling's count into the
    correct form; if that step is dropped, these flip and the checker starts
    giving actively harmful advice.
    """
    hits = check(correct, min_ratio=2)
    assert not any(h.suggestion == misspelling for h in hits), hits
    assert lexicon._lexicon().get(misspelling, 0) == 0


@needs_lexicon
@pytest.mark.parametrize("word", ["නියමිතය", "පවතී", "කරයි"])
def test_word_final_inflection_is_not_a_spelling_error(word):
    """
    Regression: appending a vowel sign to the END of a Sinhala word changes its
    grammatical form, it does not fix a typo. නියමිතය and නියමිතයි are both
    correct — the first is the formal predicate ending news copy uses, and the
    colloquial form is 13x commoner, so frequency alone "corrected" good
    journalism into the wrong register.
    """
    assert check(word, min_ratio=2) == []


@needs_lexicon
def test_leaves_alone_words_the_corpus_knows():
    """
    _MAX_SEEN: an attested word is never second-guessed. Each of these is
    correct as written but rarer in ITN than its misspelling, so a pure ratio
    test proposed the error — බැණ->බැන, මඟහැර->මගහැර, සක්‍රියව->සක්‍රීයව.
    """
    for word in ("බැණ", "මඟහැර", "සක්‍රියව", "වෛද්‍යවරයකු"):
        assert check(word, min_ratio=2) == [], word


@needs_lexicon
def test_higher_ratio_is_never_noisier():
    """The knob has to be monotonic or it cannot be tuned."""
    sentence = "අපරාධ පරීක්ශන දෙපාර්තමේන්තුවේ රැදවුම් නියෝග මත නදුන් යන අය."
    counts = [len(check(sentence, min_ratio=r)) for r in (2, 3, 5, 10, 20)]
    assert counts == sorted(counts, reverse=True), counts


@needs_lexicon
def test_suggestions_are_ordered_by_evidence():
    sentence = "අපරාධ පරීක්ශන දෙපාර්තමේන්තුවේ රැදවුම් නියෝග මත නදුන් යන අය."
    hits = check(sentence, min_ratio=2)
    assert [h.suggestion_seen for h in hits] == sorted(
        [h.suggestion_seen for h in hits], reverse=True
    )


@needs_lexicon
def test_positions_point_at_the_flagged_word():
    """The UI underlines by offset; a wrong one marks the wrong word."""
    sentence = "වැරදිකරු බවට තීරණය කෙරුනි."
    for hit in check(sentence):
        assert sentence[hit.position : hit.position + len(hit.original)] == hit.original


@needs_lexicon
def test_result_is_capped():
    """A badly OCR'd paste must not return a wall of noise."""
    junk = " ".join(["පරීක්ශන", "රැදවුම්", "නදුන්", "කෙරුනි"] * 40)
    assert len(check(junk, min_ratio=2, max_suggestions=5)) <= 5


# ── Degradation ──

def test_blank_input_returns_nothing():
    assert check("") == []
    assert check("   ") == []


def test_missing_lexicon_degrades_to_silence(monkeypatch):
    """
    Advisory extra: a missing data file must never fail a grammar request that
    would otherwise have succeeded.
    """
    monkeypatch.setattr(lexicon, "_lexicon", lambda: {})
    assert check("අපරාධ පරීක්ශන දෙපාර්තමේන්තුවේ") == []


def test_suggestion_is_immutable():
    """Nothing downstream may rewrite a suggestion into an applied edit."""
    s = Suggestion(position=0, original="අ", suggestion="ආ", seen=1, suggestion_seen=99)
    with pytest.raises(Exception):
        s.suggestion = "වෙනස්"


@needs_lexicon
def test_every_occurrence_is_flagged_not_just_the_first():
    """
    A misspelling used three times must be flagged three times.

    check() used to dedupe by word, so a client marking by offset underlined
    the first occurrence and left the rest bare — which reads as the checker
    changing its mind rather than as a deliberate limit, and left the reader
    no way to fix the ones it skipped.
    """
    sentence = "දුෂණ චෝදනා ගැන කතා විය. දුෂණ නැවතීමට නම් දුෂණ ගැන දැනුවත් විය යුතුය."
    flagged = [s for s in check(sentence) if s.original == "දුෂණ"]

    assert sentence.count("දුෂණ") == 3
    assert len(flagged) == 3
    assert len({s.position for s in flagged}) == 3


@needs_lexicon
def test_every_suggestion_anchors_at_its_offset():
    """
    The offset must index the exact word, or a client marks the wrong one.
    Clients verify this and silently drop anything that fails, so a drift here
    shows up as "flagged in the list but not underlined in the text".
    """
    sentence = "දුෂණ චෝදනා. ජුනි මාසයේ පරීක්ශන පැවැත්විණි. දුෂණ නැවතිය යුතුය."
    for s in check(sentence):
        assert sentence[s.position:s.position + len(s.original)] == s.original


@needs_lexicon
def test_results_are_in_document_order():
    """Reviewing against the text is impossible if the list jumps around it."""
    sentence = "දුෂණ චෝදනා. ජුනි මාසයේ පරීක්ශන පැවැත්විණි. මගහැර ගිය ජිප් රථය."
    positions = [s.position for s in check(sentence)]
    assert positions == sorted(positions)


# ── Sentence-final participle rule ──

from app.services.grammar import sentence_final  # noqa: E402


@needs_lexicon
def test_sentence_final_participle_is_flagged():
    """-මින් at a sentence end should be -මිනි (90.6% of the time in corpus)."""
    text = "ඔහු මේ බව පැවසුවේ වැඩසටහන සමඟ එක්වෙමින්."
    got = sentence_final.check(text, lexicon._lexicon())
    assert [(s.original, s.suggestion) for s in got] == [("එක්වෙමින්", "එක්වෙමිනි")]
    assert text[got[0].position:got[0].position + len(got[0].original)] == got[0].original


@needs_lexicon
def test_mid_sentence_participle_is_left_alone():
    """
    The whole rule is positional. Mid-sentence -මින් is correct and is 16,616
    of the 16,637 occurrences measured — flagging it would be wrong far more
    often than right.
    """
    assert sentence_final.check("වැඩසටහන සමඟ එක්වෙමින් ඔහු පැවසීය.", lexicon._lexicon()) == []


@needs_lexicon
def test_vocative_noun_is_excluded():
    """ස්වාමින් is a noun, not a participle, and both spellings are real."""
    assert sentence_final.check("ගරු ස්වාමින්.", lexicon._lexicon()) == []


@needs_lexicon
def test_unattested_final_form_is_not_invented():
    """No corpus evidence for the -මිනි counterpart means no suggestion."""
    for s in sentence_final.check("ඔහු කෙසේවත් ගොනුමින්.", lexicon._lexicon()):
        assert s.suggestion_seen > 0


def test_without_a_lexicon_the_rule_is_silent():
    """Advisory layer: no data means no guess, never a crash."""
    assert sentence_final.check("එක්වෙමින්.", None) == []
    assert sentence_final.check("එක්වෙමින්.", {}) == []


@needs_lexicon
def test_dropped_vowel_typo_resolves_to_the_grammatically_correct_form():
    """
    Reported: a dropped-vowel typo (සක්‍රය, missing the vowel sign entirely)
    was suggested as සක්‍රීය — itself a common misspelling.

    Corpus frequency has this backwards: සක්‍රීය outnumbers සක්‍රිය 4.6x. But
    the bare root ක්‍රියා ("action") is written with the short vowel with zero
    exceptions across 40,000+ occurrences of its inflections — writers get the
    root right and the sa-/a- prefixed form wrong, plausibly by false analogy
    with the genuine long "-ීය" adjectival suffix (as in සමාජීය). Curated in
    build_corpus_dataset.CURATED_NORMALIZE; this pins the fix at the lexicon.
    """
    got = check("මෙය සක්‍රය ලෙස සලකනු ලැබේ.")
    assert [(s.original, s.suggestion) for s in got] == [("සක්‍රය", "සක්‍රිය")]


@needs_lexicon
def test_the_common_long_form_misspelling_is_itself_caught():
    """The curated fold must make සක්‍රීය directly correctable too, not just
    reachable as a completion of the dropped-vowel typo."""
    got = check("එම පද්ධතිය සක්‍රීය කෙරිණි. එය අක්‍රීය තත්වයේ තිබුණි.")
    assert [(s.original, s.suggestion) for s in got] == [
        ("සක්‍රීය", "සක්‍රිය"),
        ("අක්‍රීය", "අක්‍රිය"),
    ]


@needs_lexicon
def test_the_correct_short_forms_are_never_flagged():
    assert check("එය සක්‍රිය කර ඇත. එය අක්‍රිය කර ඇත.") == []


@needs_lexicon
def test_the_root_word_and_its_inflections_are_never_flagged():
    """ක්‍රියා/ක්‍රියාව/ක්‍රියාත්මක/ක්‍රියාකාරී are unambiguous — the curated
    pair must not spill over onto the root the prefixed forms are built on."""
    assert check("එය ක්‍රියාත්මක කරන ලදී. ක්‍රියාව අවසන් විය.") == []
