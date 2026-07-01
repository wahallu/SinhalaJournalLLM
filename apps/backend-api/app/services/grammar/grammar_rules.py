"""
Dummy Sinhala grammar correction rules.

Each rule is a dict with:
  - pattern:     the incorrect text fragment to find
  - replacement: the correct replacement
  - rule:        human-readable description of the grammar rule

These will be replaced by the fine-tuned SinLlama model inference later.
The patterns cover common Sinhala grammar mistakes:
  1. Incorrect verb endings / conjugations
  2. Particle / postposition errors
  3. Common misspellings
  4. Spacing / punctuation issues
  5. Virama and vowel sign misuse
"""

GRAMMAR_RULES: list[dict[str, str]] = [
    # ── Verb ending corrections ──
    {
        "pattern": "යනව",
        "replacement": "යනවා",
        "rule": "Verb ending: missing long vowel marker (ā) on verb",
    },
    {
        "pattern": "කරනව",
        "replacement": "කරනවා",
        "rule": "Verb ending: missing long vowel marker (ā) on verb",
    },
    {
        "pattern": "ඉන්නව",
        "replacement": "ඉන්නවා",
        "rule": "Verb ending: missing long vowel marker (ā) on verb",
    },
    {
        "pattern": "බලනව",
        "replacement": "බලනවා",
        "rule": "Verb ending: missing long vowel marker (ā) on verb",
    },
    {
        "pattern": "කියනව",
        "replacement": "කියනවා",
        "rule": "Verb ending: missing long vowel marker (ā) on verb",
    },
    {
        "pattern": "දෙනව",
        "replacement": "දෙනවා",
        "rule": "Verb ending: missing long vowel marker (ā) on verb",
    },
    {
        "pattern": "ලියනව",
        "replacement": "ලියනවා",
        "rule": "Verb ending: missing long vowel marker (ā) on verb",
    },
    {
        "pattern": "කනව",
        "replacement": "කනවා",
        "rule": "Verb ending: missing long vowel marker (ā) on verb",
    },
    {
        "pattern": "බොනව",
        "replacement": "බොනවා",
        "rule": "Verb ending: missing long vowel marker (ā) on verb",
    },
    {
        "pattern": "එනව",
        "replacement": "එනවා",
        "rule": "Verb ending: missing long vowel marker (ā) on verb",
    },

    # ── Particle / postposition corrections ──
    {
        "pattern": "ගෙදරට යනව",
        "replacement": "ගෙදර යනවා",
        "rule": "Postposition: unnecessary -ට suffix with ගෙදර (home)",
    },
    {
        "pattern": "මම ඔයට",
        "replacement": "මම ඔයාට",
        "rule": "Pronoun form: ඔය should be ඔයා before postposition -ට",
    },
    {
        "pattern": "ඔයගෙ",
        "replacement": "ඔයාගේ",
        "rule": "Possessive: ඔයගෙ → ඔයාගේ (correct possessive form)",
    },
    {
        "pattern": "මගෙ",
        "replacement": "මගේ",
        "rule": "Possessive: missing long vowel in possessive marker මගේ",
    },
    {
        "pattern": "එයගෙ",
        "replacement": "ඔහුගේ",
        "rule": "Pronoun form: එයගෙ should be ඔහුගේ in formal writing",
    },

    # ── Common misspellings ──
    {
        "pattern": "විද්‍යලය",
        "replacement": "විද්‍යාලය",
        "rule": "Spelling: විද්‍යලය → විද්‍යාලය (school)",
    },
    {
        "pattern": "පාසල",
        "replacement": "පාසැල",
        "rule": "Spelling: incorrect vowel in පාසැල (school)",
    },
    {
        "pattern": "ගුරුවරයා",
        "replacement": "ගුරුවරයා",
        "rule": "Spelling: correct form validated",
    },
    {
        "pattern": "ප්‍රශ්නය",
        "replacement": "ප්‍රශ්නය",
        "rule": "Spelling: correct form validated",
    },

    # ── Spacing corrections ──
    {
        "pattern": "  ",
        "replacement": " ",
        "rule": "Spacing: double space reduced to single space",
    },

    # ── Punctuation ──
    {
        "pattern": " .",
        "replacement": ".",
        "rule": "Punctuation: remove space before period",
    },
    {
        "pattern": " ,",
        "replacement": ",",
        "rule": "Punctuation: remove space before comma",
    },
]
