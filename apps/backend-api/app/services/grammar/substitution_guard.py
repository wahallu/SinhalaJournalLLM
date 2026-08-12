"""
Flag word replacements that look like the model swapping in a different word
rather than correcting a spelling — above all, a different NAME.

Why this exists
---------------
The grammar adapter's worst failure is not a missed correction, it is a
confident wrong one. Measured across the v24 and v25 eval transcripts, the same
substitutions appear in both:

    ගුනවර්ධන  -> ගුණසේකර     (one surname replaced with another)
    කරුනාතිලක -> කරුණාරත්න    (likewise)
    වරුශ      -> වරුණ         (a given name turned into a different name)

Roughly 1.5-2% of examples come back factually altered this way. The model
recognises the *shape* of a name and emits the name form it knows best.

Severity is not uniform, and this module is tuned accordingly. A verb-form slip
(විය -> වුණා) reads oddly but leaves the facts intact. A renamed person is a
false statement about a real human being, published under a newsroom's name.
The first is noise; the second is the thing worth interrupting an editor for.
So name-shaped replacements are flagged on their own dedicated rule, ahead of
and independent of every similarity heuristic — a name swap is caught even when
the two words are superficially similar.

This is not fixable by retraining — v10 corrected the training answers and both
surname cases survived unchanged into v25 — because it is not a spelling error.

How it decides
--------------
Rule 0 fires first and alone. Rules 1-2 catch the general case, and are
suppressed by the exemptions below.

0. NAME-SUFFIX CHANGE  (the critical rule)
   Sinhala surnames are built from a closed set of formative endings —
   වර්ධන, සේකර, රත්න, තිලක, නායක, බණ්ඩාර … If a word ending in one of them is
   replaced by a word ending in a DIFFERENT one, that is a renamed person, not
   a corrected spelling. ගුනවර්ධන -> ගුණසේකර and කරුනාතිලක -> කරුණාරත්න are
   both caught here. Crucially this does not depend on how similar the two
   strings are, so it still fires on near-miss pairs that rules 1-2 would let
   through. A name whose suffix is unchanged (ගුනවර්ධන -> ගුණවර්ධන, fixing
   න -> ණ) is a spelling correction and is not flagged.

1. LOW SIMILARITY  (ratio < 0.55)
   Wholesale replacements: අකුරු -> අත්සන් is 0.182. Every genuine spelling
   correction measured sits far above this — the lowest is සමග -> සමඟ at 0.667.

2. CROSS-FAMILY LETTER SWAP
   Rule 1 alone cannot catch වරුශ -> වරුණ (0.750) without also flagging
   සමග -> සමඟ (0.667), and සමඟ is a real correction appearing in 948 training
   rows — so no threshold separates them. But they differ in kind: සමග/සමඟ
   swaps within one confusable family (ග/ඟ), while වරුශ/වරුණ swaps a sibilant
   for a nasal. Sinhala misspellings confuse letters that sound or look alike;
   they do not cross families.

   This rule requires POSITIVE evidence of a crossing: both characters must be
   known members of families, and those families must differ. It deliberately
   does not fire merely because a character is absent from the table — an
   earlier version did, and flagged විශිෂ්ඨ -> විශිෂ්ට and කිව්වා -> කිව්වේ
   because ට/ඨ and the vowel signs were simply missing. The table cannot be
   assumed complete, so absence of evidence is treated as evidence of nothing.

Exemptions (rules 1-2 only; rule 0 always wins)
-----------------------------------------------
Each covers a correction the model is legitimately trained to make and which
scores far below the similarity floor:

  * literary/colloquial verb pairs (විය -> වුණා, 0.286)
  * -නවා verb morphology sharing a stem (කරනවා -> කළහ, 0.250)
  * a small closed set of pronoun and particle fixes (ඇයන් -> ඔවුන්, 0.444)
  * a single same-family letter swap (කල -> කළ, 0.500)

None of these can mask a name: no Sinhala name ends in -නවා, and the pair and
pronoun lists are closed and contain no names.

Measured against every correction the grammar benchmark asks for (135 across
four stages): 0 false positives. Known gaps — multi-character replacements
above the floor that are not name-shaped, e.g. පත්කිරිම් -> පත්වීම් (0.625).
Closing those needs a real dictionary; the only one available is a corpus that
contains its own misspellings.

Nothing here modifies the text. Flagged corrections are still applied — the flag
travels alongside so a client can surface it for a human to judge.
"""

from __future__ import annotations

from difflib import SequenceMatcher

# Below this, a single-word replacement is treated as a substitution rather than
# a spelling fix. Measured separation: worst genuine correction 0.667
# (සමග -> සමඟ), best known corruption 0.444 (කරුනාතිලක -> කරුණාරත්න).
SIMILARITY_FLOOR = 0.55

# Formative endings of Sinhala personal/family names. A word ending in one of
# these that is replaced by a word ending in a *different* one has been renamed.
# Ordered longest-first at match time so කරුණාරත්න matches රත්න, not න.
_NAME_SUFFIXES: tuple[str, ...] = (
    "වර්ධන", "වර්ධන්", "සේකර", "සේකරා", "රත්න", "රත්නේ", "තිලක", "තිලකා",
    "නායක", "නායකේ", "බණ්ඩාර", "සූරිය", "සුරිය", "තුංග", "සිංහ", "සිංහේ",
    "දාස", "පාල", "වීර", "කුමාර", "කුමාරි", "ආරච්චි", "විතාන", "පේරුම",
    "මාන්න", "ගුණරත්න", "ජයවර්ධන", "විජේසේකර", "රාජපක්ෂ", "පෙරේරා",
    "සිල්වා", "ප්‍රනාන්දු", "මෙන්ඩිස්", "ගමගේ", "හේරත්", "ඒකනායක",
    "දිසානායක", "අබේසිංහ", "වික්‍රම", "සම්පත්", "චන්ද්‍ර",
)

# Letters that Sinhala writers genuinely confuse. A swap *within* one of these
# groups is an ordinary misspelling; a swap that crosses groups is not. This
# table is known to be incomplete — see rule 2 in the module docstring for why
# that is safe.
_CONFUSABLE_FAMILIES: tuple[frozenset[str], ...] = (
    frozenset({"න", "ණ"}),
    frozenset({"ල", "ළ"}),
    frozenset({"ද", "ඳ"}),
    frozenset({"ග", "ඟ"}),
    frozenset({"ජ", "ඣ"}),
    frozenset({"බ", "ඹ"}),
    frozenset({"ඩ", "ඬ"}),
    frozenset({"ශ", "ෂ", "ස"}),
    frozenset({"ි", "ී"}),
    frozenset({"ු", "ූ"}),
    frozenset({"ෙ", "ේ"}),
    frozenset({"ො", "ෝ"}),
)

# Literary <-> colloquial verb conversions the adapter is trained to perform.
# Mirrors build_corpus_dataset.VERB_DOWNGRADE (which runs literary -> colloquial
# to synthesise errors); the model performs the inverse, so both directions are
# allowed. Kept as a copy rather than an import: backend-api does not depend on
# the dataset-building repo, and that list changing should not silently change
# production behaviour.
_VERB_FORMS: tuple[tuple[str, str], ...] = (
    ("කළේය", "කළා"), ("කළහ", "කළා"), ("කළෝය", "කළා"),
    ("පැවසීය", "පැවසුවා"), ("පැවසූහ", "පැවසුවා"),
    ("සිටියහ", "සිටියා"), ("සිටියේය", "සිටියා"),
    ("ගත්හ", "ගත්තා"), ("ගත්තේය", "ගත්තා"),
    ("වූහ", "වුණා"), ("විය", "වුණා"),
    ("ඇමතීය", "ඇමතුවා"),
    ("දුන්නේය", "දුන්නා"), ("දුන්හ", "දුන්නා"),
    ("ලැබූහ", "ලැබුවා"),
    ("පවත්වූහ", "පවත්වනවා"),
    ("පවසයි", "පවසනවා"), ("පවසති", "පවසනවා"),
    ("කරයි", "කරනවා"), ("කරති", "කරනවා"),
    ("ලැබේ", "ලැබෙනවා"), ("ලබයි", "ලබනවා"),
    ("නිකුත් කරයි", "නිකුත් කරනවා"),
    ("පැවැත්විණි", "පැවැත්වුනා"), ("කෙරිණි", "කෙරුනා"),
    ("විණි", "වුනා"),
    ("බවයි", "කියලා"), ("බවය", "කියලා"),
)

# Closed-class fixes the benchmark asks for that score below the floor. Derived
# from the gold answers, not guessed: ඇයන්/ඔහුන් are wrong-plural pronouns and
# නෑ is the colloquial negation.
_CLOSED_CLASS: tuple[tuple[str, str], ...] = (
    ("ඇයන්", "ඔවුන්"), ("ඔහුන්", "ඔවුන්"), ("ඌන්", "ඔවුන්"),
    ("නෑ", "නැහැ"), ("නැත", "නෑ"),
)

_ALLOWED_PAIRS: frozenset[tuple[str, str]] = frozenset(
    pair
    for a, b in _VERB_FORMS + _CLOSED_CLASS
    for pair in ((a, b), (b, a))
)

# Trailing punctuation must not defeat the allowlist: the eval transcripts show
# these as "කරනවා." -> "කළා.", with the stop attached to the token.
_STRIP = " \t\n‍.,!?;:\"'()[]{}…"

_COLLOQUIAL_PRESENT = "නවා"


def _bare(word: str) -> str:
    return word.strip(_STRIP)


def _name_suffix(word: str) -> str | None:
    """The name-formative ending this word carries, longest match, else None."""
    for suffix in sorted(_NAME_SUFFIXES, key=len, reverse=True):
        if word.endswith(suffix) and len(word) > len(suffix):
            return suffix
    return None


def is_probable_name(word: str) -> bool:
    """Whether a token is a known surname or carries a known name ending.

    The original substitution rule required extra material before an ending,
    which is correct for comparing formative suffixes but excluded standalone
    surnames such as පෙරේරා. The hybrid safety gate needs the broader question
    while retaining the existing rule unchanged.
    """
    bare = _bare(word)
    return any(bare == suffix or bare.endswith(suffix) for suffix in _NAME_SUFFIXES)


def is_name_substitution(original: str, corrected: str) -> bool:
    """
    True when a name-shaped word is replaced by one carrying a *different* name
    ending — ගුනවර්ධන -> ගුණසේකර. Fixing a name's spelling without touching its
    ending (ගුනවර්ධන -> ගුණවර්ධන) is not a substitution.
    """
    orig_suffix = _name_suffix(_bare(original))
    corr_suffix = _name_suffix(_bare(corrected))
    return (
        orig_suffix is not None
        and corr_suffix is not None
        and orig_suffix != corr_suffix
    )


def _is_allowed_pair(original: str, corrected: str) -> bool:
    return (_bare(original), _bare(corrected)) in _ALLOWED_PAIRS


def _is_verb_morphology(original: str, corrected: str) -> bool:
    """
    Colloquial -නවා present tense converting to a past/literary form, or the
    reverse: කරනවා -> කළහ, ගනිනවා -> ගත්හ, දෙනවා -> දුන්නා.

    Requires a shared opening character so the stem is preserved — this is what
    keeps it from waving through an unrelated word. No Sinhala name ends in
    -නවා, so this cannot mask a renamed person.
    """
    orig, corr = _bare(original), _bare(corrected)
    if not orig or not corr or orig[0] != corr[0]:
        return False
    return orig.endswith(_COLLOQUIAL_PRESENT) or corr.endswith(_COLLOQUIAL_PRESENT)


def _single_char_swap(original: str, corrected: str) -> tuple[str, str] | None:
    """The one differing character pair, if these differ by exactly one."""
    if len(original) != len(corrected):
        return None
    differing = [(a, b) for a, b in zip(original, corrected) if a != b]
    return differing[0] if len(differing) == 1 else None


def _family_of(char: str) -> frozenset[str] | None:
    for family in _CONFUSABLE_FAMILIES:
        if char in family:
            return family
    return None


def inspect_substitution(original: str, corrected: str) -> tuple[bool, str | None]:
    """
    Judge one word-level replacement.

    Returns (suspicious, reason). `reason` is None when the replacement looks
    legitimate, and otherwise a short human-readable explanation suitable for
    showing next to the correction.
    """
    orig, corr = _bare(original), _bare(corrected)

    # Only single-word replacements are in scope. Insertions, deletions and
    # multi-word rewrites are a different failure mode and are left alone.
    if not orig or not corr or " " in orig or " " in corr or orig == corr:
        return False, None

    # Rule 0 — the critical one. Checked before every exemption, and without
    # reference to similarity, because a renamed person is a false statement of
    # fact and must be caught even when the two spellings look alike.
    if is_name_substitution(orig, corr):
        return True, (
            "This looks like one name replaced by a different name, not a "
            "spelling correction. Verify against the source before publishing."
        )

    if _is_allowed_pair(original, corrected):
        return False, None
    if _is_verb_morphology(original, corrected):
        return False, None

    # A pure prefix/suffix edit is morphology (කිරිම -> කිරීම), never a
    # wholesale replacement, regardless of how short the words are.
    if corr.startswith(orig) or orig.startswith(corr):
        return False, None

    swap = _single_char_swap(orig, corr)
    if swap is not None:
        left, right = _family_of(swap[0]), _family_of(swap[1])
        if left is not None and left is right:
            # Same confusable family — an ordinary misspelling, whatever the
            # similarity score says (කල -> කළ scores only 0.500).
            return False, None
        if left is not None and right is not None:
            return True, (
                "Replaced with a different word — the changed letter is not one "
                "Sinhala spelling normally confuses. Check this is not a name."
            )

    if SequenceMatcher(None, orig, corr).ratio() < SIMILARITY_FLOOR:
        return True, (
            "Replaced with a substantially different word rather than "
            "corrected. Check this is not a name."
        )

    return False, None
