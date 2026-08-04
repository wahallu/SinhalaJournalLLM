"""Scraper-artifact stripping shared by the headline prompt (article side) and
the headline service (generated-output side).

Sri Lankan news scrapers (Hiru/ITN and others) tag articles and headlines with
bracketed media markers -- "(වීඩියෝ)", "[Video]", "- Photos", "(Photo)" -- and
those tags leak into generated headlines two ways:

1. The article body itself often carries an inline tag near the headline or
   lede ("... Telegram ය! (වීඩියෝ)"). The model can copy it straight into the
   generated headline regardless of how clean the training *labels* are,
   because the tag is sitting right there in its input context.
2. Some training references still ended in one of these tags (see
   SinAI-Training/work/sinllama/scripts/clean_headline_dataset.py -- v19
   dropped this from 11-22% down to ~1-3%, not to zero), so the model also
   partly learned the pattern as a legitimate headline ending.

Retraining (SinAI-Training's v20, once available) addresses #2 and reduces
#1. This module is the immediate, retrain-independent fix: strip tags from
the article before it ever reaches the prompt, and strip anything that still
slips through from the generated headline before it's returned. Must stay
loosely in sync with SinAI-Training's clean_headline_dataset.py -- same word
list, same idea -- though exact regex need not be byte-identical since this
runs on free text (article/output), not dataset preprocessing.
"""

import re

_ARTIFACT_WORD = (
    r"(?:වීඩියෝ|ඡායාරූප|VIDEO|PHOTOS?|Video|PICTURES?|Interview|GALLERY)"
)
_SEP = r"[\s\-–—:()\[\]|•~!]*"

# Anchored to the end of a string -- for stripping a tag off a generated
# headline, where the tag is essentially always trailing.
_TRAILING_ARTIFACT = re.compile(
    rf"{_SEP}{_ARTIFACT_WORD}(?:{_SEP}{_ARTIFACT_WORD})*{_SEP}$",
    re.IGNORECASE,
)

# Not anchored -- for stripping tags out of raw article text, where they can
# appear inline (after a sentence, before a paragraph, wherever the scraper
# inserted them), not just at the very end.
_INLINE_ARTIFACT = re.compile(
    rf"[(\[][\s]*{_ARTIFACT_WORD}[\s]*[)\]]|(?<=[\s.!?])[\-–—][\s]*{_ARTIFACT_WORD}\b",
    re.IGNORECASE,
)


def strip_headline_artifacts(headline: str) -> str:
    """Removes a trailing scraper tag from a generated headline. Safe to call
    on every candidate before word-count/band logic runs, since the word
    count should reflect real content, not a tag riding along on it."""
    if not headline:
        return headline
    cleaned = _TRAILING_ARTIFACT.sub("", headline).strip()
    cleaned = re.sub(r"[\s\-–—:!]+$", "", cleaned).strip()
    return cleaned or headline  # never return empty; keep the original if the whole thing was "artifact"


def strip_article_media_tags(article: str) -> str:
    """Removes inline scraper tags -- "(Video)", "[Photo]", "- Video" -- from
    article text before it's used to build a headline prompt, so the model
    has nothing to copy in the first place. Applied once per request; cheap
    relative to the model call it precedes."""
    if not article:
        return article
    return re.sub(r"[ \t]{2,}", " ", _INLINE_ARTIFACT.sub("", article)).strip()
