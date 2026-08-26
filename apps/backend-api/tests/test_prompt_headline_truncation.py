"""
Regression test: prompt_headline() must cap the article at MAX_ARTICLE_CHARS.

The headline adapter was trained and evaluated (train_headline_v19.py /
test_headline_v19.py, both in SinAI-Training) on articles truncated to 2000
characters -- that's the only length distribution it has ever seen a
coherent continuation for. HeadlineRequest.text accepts up to 10000 chars,
and prompt_headline() previously passed the full text through untouched, so
a real long article could run 3-5x past the training envelope -- a likely
driver of "great in test scripts, meaningless on a real article", since the
eval harness structurally can never exceed the same cap it enforces.
"""

from app.core.prompts import MAX_ARTICLE_CHARS, prompt_headline


def test_long_article_is_truncated_to_the_training_cap():
    long_article = "ලිපිය " * 1000  # 6000 chars, well past the 2000 cap
    prompt = prompt_headline(long_article, category="General", length="medium")

    article_section = prompt.split("Article: ", 1)[1].split("\n\n### Response:")[0]
    assert len(article_section) <= MAX_ARTICLE_CHARS


def test_short_article_is_unaffected():
    short_article = "කෙටි ලිපියක් මෙහි ඇත."
    prompt = prompt_headline(short_article, category="General", length="medium")

    assert short_article in prompt
