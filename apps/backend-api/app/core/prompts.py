"""
Canonical prompt templates and style/length definitions.

These mirror the Alpaca-style templates used to fine-tune the SinLlama task
adapters (see SinAI-Training/work/sinllama/serve_sinai.py). Keeping them
byte-identical to the training distribution matters: the model server accepts
either raw text (it wraps it itself) or a fully-formed prompt containing
"### Instruction:" (passed through untouched). We send fully-formed prompts
when we need knobs the server doesn't expose — e.g. summary length.
"""

# ── Style rewriter ──
# The five styles the style adapter (style_sinllama_v07) was trained on.
# Keys are the API contract; every client (web app, extension, docs add-on)
# must send one of these.
STYLE_INSTRUCTIONS: dict[str, str] = {
    "formal": (
        "පහත සිංහල පාඨය නිල හා වෘත්තීය පුවත් ශෛලියට (formal news style) නැවත ලියන්න.\n"
        "සරල, නිවැරදි සිංහල භාෂාව භාවිත කරන්න. "
        "ආත්මීය හෝ අනවශ්‍ය සංවාදාත්මක වචන ඉවත් කරන්න."
    ),
    "sports": (
        "පහත සිංහල පාඨය ජීවමාන හා ශක්තිමත් ක්‍රීඩා පුවත් ශෛලියට (sports journalism style) නැවත ලියන්න.\n"
        "ක්‍රියාශීලී ක්‍රියා පද, ශක්තිමත් ගොනු ශීර්ෂ, හා ක්‍රීඩා ශබ්ද කෝෂය භාවිත කරන්න."
    ),
    "youth": (
        "පහත සිංහල පාඨය තරුණ පාඨකයන් ඉලක්ක කරගත් සරල, ගතිකාරී ශෛලියකට (youth/casual style) නැවත ලියන්න.\n"
        "සරල වාක්‍ය, කෙළින්ම කතා කරන ලෙස, හා නවීන සිංහල ප්‍රකාශන භාවිත කරන්න. "
        "ඉතා කාර්යාල ලෙසට ලියූ ශෛලිය ඉවත් කරන්න."
    ),
    "editorial": (
        "පහත සිංහල පාඨය ගැඹුරු විශ්ලේෂණාත්මක සංස්කාරකීය ශෛලියකට (editorial/opinion style) නැවත ලියන්න.\n"
        "කරුණු ඉදිරිපත් කරමින් විශ්ලේෂණය, ආකල්ප, හා ගැඹුරු සිතුවිලි ඇතුළත් කරන්න. "
        "ශක්තිමත් හා ඒත්තු ගැන්වෙන ශෛලිය භාවිත කරන්න."
    ),
    "feature": (
        "පහත සිංහල පාඨය කතා කරන ආකාරයේ feature ලිපි ශෛලියකට (feature writing style) නැවත ලියන්න.\n"
        "දෘශ්‍යමාන භාෂාව, ජීවිත කතා ශෛලිය, හා කාව්‍යාත්මක පාඨ භාවිත කරන්න. "
        "කරුණු ඉදිරිපත් කිරීම සිත් ඇදගන්නා සුළු වේ."
    ),
}

DEFAULT_STYLE = "formal"
VALID_STYLES = set(STYLE_INSTRUCTIONS.keys())

# Older clients (and the R26-SE-037 demo) used a different tone vocabulary.
# Accept those values but map them onto the styles the adapter knows.
STYLE_ALIASES: dict[str, str] = {
    "journalistic": "formal",
    "casual": "youth",
    "news": "formal",
    "opinion": "editorial",
}

# English + Sinhala labels for clients that render a style picker from /meta.
STYLE_LABELS: dict[str, dict[str, str]] = {
    "formal": {"en": "Formal", "si": "නිල"},
    "sports": {"en": "Sports", "si": "ක්‍රීඩා"},
    "youth": {"en": "Youth", "si": "තරුණ"},
    "editorial": {"en": "Editorial", "si": "සංස්කාරකීය"},
    "feature": {"en": "Feature", "si": "විශේෂාංග"},
}


def resolve_style(tone: str | None) -> str:
    """Map a client-supplied tone onto a trained style, defaulting to formal."""
    if not tone:
        return DEFAULT_STYLE
    tone = tone.strip().lower()
    if tone in VALID_STYLES:
        return tone
    return STYLE_ALIASES.get(tone, DEFAULT_STYLE)


# ── Summarizer lengths ──
# serve_sinai.py hardcodes a ~10% word target. Length control happens on
# our side by sending a fully-formed prompt with a different target.
SUMMARY_LENGTHS: dict[str, dict] = {
    "short": {"ratio": 0.08, "min_words": 15, "label_en": "Short", "label_si": "කෙටි"},
    "medium": {"ratio": 0.18, "min_words": 30, "label_en": "Medium", "label_si": "මධ්‍යම"},
    "long": {"ratio": 0.30, "min_words": 50, "label_en": "Long", "label_si": "දීර්ඝ"},
}

DEFAULT_LENGTH = "medium"


def resolve_length(length: str | None) -> str:
    if not length:
        return DEFAULT_LENGTH
    length = length.strip().lower()
    return length if length in SUMMARY_LENGTHS else DEFAULT_LENGTH


# ── Prompt builders (Alpaca format, identical to training) ──

def prompt_grammar(text: str) -> str:
    return (
        "### Instruction:\n"
        "ඔබ සිංහල භාෂා විශේෂඥයෙකි.\n"
        "පහත සිංහල පාඨයේ ඇති වාකරණ දෝෂ, අක්ෂර වින්‍යාස දෝෂ සහ විරාම ලකුණු දෝෂ නිවැරදි කරන්න.\n"
        "නිවැරදි කළ පාඨය පමණක් ලියන්න. වෙනත් කිසිදු පැහැදිලි කිරීමක් එකතු නොකරන්න.\n\n"
        f"Text:\n{text}\n\n"
        "### Response:\n"
    )


# ── Headline lengths ──
# Non-overlapping word bands, so every word count maps to exactly one band and
# "did this land in the requested band" needs no tiebreak rule. Mirrored in
# SinAI-Training/work/tasks/headline.py (which owns the per-band token budgets
# on the inference server) — keep the two in sync.
#
# Caveat worth knowing before trusting these: headline_sinllama_v17 was trained
# on 48K examples that ALL carried the same fixed "Between 4 and 7 words" rule
# line, so it has no length conditioning to draw on. The band line below is a
# nudge, not a contract; the guarantee comes from the word-count enforcement in
# services/headline/headline_service.py. A length-conditioned v18 (see
# SinAI-Training/work/sinllama/scripts/train_headline_v18.py) is what makes the
# nudge actually stick.
HEADLINE_LENGTHS: dict[str, dict] = {
    "short": {"min_words": 3, "max_words": 5, "label_en": "Short", "label_si": "කෙටි"},
    "medium": {"min_words": 6, "max_words": 7, "label_en": "Medium", "label_si": "මධ්‍යම"},
    "long": {"min_words": 8, "max_words": 10, "label_en": "Long", "label_si": "දීර්ඝ"},
}

DEFAULT_HEADLINE_LENGTH = "medium"


def resolve_headline_length(length: str | None) -> str:
    """Map a client-supplied headline length onto a known band, defaulting to
    medium. Unlike the summarizer's resolve_length, an unknown value silently
    falls back rather than erroring — the band only steers output, it can't
    produce a wrong task."""
    if not length:
        return DEFAULT_HEADLINE_LENGTH
    length = length.strip().lower()
    return length if length in HEADLINE_LENGTHS else DEFAULT_HEADLINE_LENGTH


def prompt_headline(
    text: str,
    category: str = "General",
    variation_hint: str | None = None,
    length: str | None = None,
    **_,
) -> str:
    """
    Headline prompt. `variation_hint` appends an extra constraint so repeated
    calls yield distinct candidates. `length` sets the word band on the rules
    line.

    Everything except the word numbers on that one line is byte-identical to
    build_prompt() in train_headline.py — the numbers themselves necessarily
    diverge from the trained "4 and 7" for the short and long bands, which is
    the whole point of the knob and also why the model only partly obeys it
    today.
    """
    band = HEADLINE_LENGTHS[resolve_headline_length(length)]
    hint = f"\n- {variation_hint}" if variation_hint else ""
    return (
        "### Instruction:\n"
        "Generate a concise Sinhala news headline for the article below.\n\n"
        "Rules:\n"
        "- Use formal Sinhala journalism style matching the article category\n"
        f"- Between {band['min_words']} and {band['max_words']} words"
        f" -- never fewer than {band['min_words']}\n"
        "- Capture the key person, event, number, or outcome\n"
        f"- Output ONLY the headline, nothing else{hint}\n\n"
        "### Input:\n"
        f"Category: {category}\n"
        f"Article: {text}\n\n"
        "### Response:\n"
    )



# Extra constraints appended to headline prompts for candidates 2..N, steering
# each candidate differently while staying within the training format.
#
# Every hint here must stay length-neutral: the requested band already owns the
# word count, and a hint that names its own number fights it (the ultra-short
# entry used to hardcode "6 words", which contradicted both the short and long
# bands).
HEADLINE_VARIATION_HINTS: list[str] = [
    "",  # canonical prompt — best candidate
    "ශීර්ෂ පාඨයේ ප්‍රධාන පුද්ගලයා හෝ ආයතනය ඉස්මතු කරන්න.",  # highlight the main actor
    "ශීර්ෂ පාඨයේ සංඛ්‍යා හෝ ප්‍රමාණ ඇතුළත් නම් ඒවා ඉස්මතු කරන්න.",  # emphasise numbers
    "ශීර්ෂ පාඨය ක්‍රියාවෙන් (verb) ආරම්භ කරන්න.",  # start with a verb
    "ශීර්ෂ පාඨය ප්‍රශ්නයක් ලෙස නොලියන්න; ප්‍රතිඵලය ඉස්මතු කරන්න.",  # emphasise outcome
    "ශීර්ෂ පාඨය ස්ථානය (location) ඉස්මතු කරමින් ලියන්න.",  # highlight location
    "ශීර්ෂ පාඨය හැඟීම් දනවන ලෙස, එහෙත් කරුණුමය ලෙස ලියන්න.",  # emotive but factual
    "ශීර්ෂ පාඨය හේතුව (cause) ඉස්මතු කරමින් ලියන්න.",  # highlight the cause
    "ශීර්ෂ පාඨය හැකි තරම් සරලව හා සෘජුව ලියන්න.",  # plainest phrasing
    "ශීර්ෂ පාඨය අනාගත බලපෑම ඉස්මතු කරමින් ලියන්න.",  # future impact
]


def prompt_summarizer(text: str, length: str = DEFAULT_LENGTH) -> str:
    cfg = SUMMARY_LENGTHS[resolve_length(length)]
    word_count = len(text.split())
    target = max(cfg["min_words"], int(word_count * cfg["ratio"]))
    return (
        "### Instruction:\n"
        "ඔබ සිංහල පුවත් ලිපි සාරාංශ කිරීමේ විශේෂඥයෙකි.\n"
        "පහත සිංහල පුවත් ලිපිය කියවා, ලිපියේ ප්‍රධාන කරුණු ඇතුළත් සාරාංශයක් ලියන්න.\n"
        f"සාරාංශය වචන {target}කට සීමා කරන්න.\n\n"
        f"Article:\n{text}\n\n"
        "### Response:\n"
    )


def prompt_style(text: str, style: str = DEFAULT_STYLE) -> str:
    instruction = STYLE_INSTRUCTIONS.get(style, STYLE_INSTRUCTIONS[DEFAULT_STYLE])
    return (
        "### Instruction:\n"
        "ඔබ සිංහල ලේඛන විශේෂඥයෙකි.\n"
        f"{instruction}\n"
        "අර්ථය වෙනස් නොකරන්න. ස්වාභාවික සිංහල භාවිත කරන්න.\n\n"
        f"Text:\n{text}\n\n"
        "### Response:\n"
    )
