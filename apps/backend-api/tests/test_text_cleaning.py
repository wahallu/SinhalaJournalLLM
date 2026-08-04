"""
Tests for app.core.text_cleaning -- the scraper-artifact stripper covering
the two paths tags leak through: the article side (copied from source into a
generated headline) and the headline-output side (a leftover training-label
pattern or a generation-time slip).
"""

from app.core.text_cleaning import strip_article_media_tags, strip_headline_artifacts


def test_strips_trailing_parenthesized_sinhala_tag():
    assert strip_headline_artifacts(
        "ඇපල් AppStore හි යළිත් වැඩ පෙන්වන්නේ Telegram ය! (වීඩියෝ)"
    ) == "ඇපල් AppStore හි යළිත් වැඩ පෙන්වන්නේ Telegram ය"


def test_strips_trailing_square_bracket_tag():
    assert strip_headline_artifacts("නව රථවාහන නීති ක්‍රියාත්මක වේ [video]") == \
        "නව රථවාහන නීති ක්‍රියාත්මක වේ"


def test_strips_trailing_dash_tag_without_brackets():
    assert strip_headline_artifacts("මිල අඩුවෙයි - photo") == "මිල අඩුවෙයි"


def test_leaves_clean_headline_untouched():
    headline = "ශ්‍රී ලංකාවට ලකුණු හතරකින් ජයක්"
    assert strip_headline_artifacts(headline) == headline


def test_falls_back_to_original_if_entire_headline_is_a_tag():
    # A pathological case shouldn't return an empty headline.
    tag_only = "(Video)"
    assert strip_headline_artifacts(tag_only) == tag_only


def test_strips_inline_parenthesized_tag_from_article_body():
    article = (
        "ඇපල් AppStore හි යළිත් වැඩ පෙන්වන්නේ Telegram ය. (Video) "
        "මේ පිළිබඳව වැඩි විස්තර මෙසේය."
    )
    cleaned = strip_article_media_tags(article)
    assert "Video" not in cleaned
    assert "යළිත් වැඩ පෙන්වන්නේ Telegram ය" in cleaned
    assert "වැඩි විස්තර මෙසේය" in cleaned


def test_strips_inline_square_bracket_and_dash_tags_from_article_body():
    article = "පුවත [Photo] තවත් තොරතුරු මෙසේය. - Video මෙය නරඹන්න."
    cleaned = strip_article_media_tags(article)
    assert "Photo" not in cleaned
    assert "Video" not in cleaned
    assert "තවත් තොරතුරු මෙසේය" in cleaned
    assert "මෙය නරඹන්න" in cleaned


def test_leaves_clean_article_untouched():
    article = "සාමාන්‍ය පුවත් ලිපියක් මෙහි ඇත. තවත් වාක්‍යයක්."
    assert strip_article_media_tags(article) == article
