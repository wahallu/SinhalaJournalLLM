"""
Tests for app.core.fact_guard -- the rule-based number/word grounding check
run against the source article. Cases below are drawn from the actual v19
hallucinations documented in the SinLlama v19 vs Claude comparison (injury
count, dengue count, death count, and the money-amount unit-conversion miss).
"""

from app.core.fact_guard import check_headline, unverified_numbers, unverified_words


def test_flags_invented_number_not_in_article():
    article = "වීරවිල ප්‍රදේශයේ බස් අනතුරකින් පුද්ගලයින් 19 දෙනෙකුට තුවාල සිදුවිය."
    headline = "බස් අනතුරින් 10කට තුවාල"
    assert unverified_numbers(article, headline) == ["10"]


def test_accepts_number_present_in_article():
    article = "වීරවිල ප්‍රදේශයේ බස් අනතුරකින් පුද්ගලයින් 19 දෙනෙකුට තුවාල සිදුවිය."
    headline = "වීරවිල බස් අනතුරකින් 19කට තුවාල"
    assert unverified_numbers(article, headline) == []


def test_flags_wrong_dengue_count():
    article = "මෙරට ඩෙංගු රෝගීන් සංඛ්‍යාව 80,905 දක්වා ඉහළ ගොස් ඇත."
    headline = "ජූලි මාසයට පමණක් ඩෙංගු රෝගින් 75,000 ඉක්මවයි"
    assert unverified_numbers(article, headline) == ["75,000"]


def test_flags_off_by_one_death_count():
    article = "පාකිස්ථානයේ ආරක්ෂක මුරපොලකට එල්ල වූ බෝම්බ ප්‍රහාරයකින් 15ක් ජීවිතක්ෂයට පත්විය."
    headline = "පාකිස්තානයේ ත්‍රස්ත ප්‍රහාරයක් - 16 ක් මරුට"
    assert unverified_numbers(article, headline) == ["16"]


def test_unit_conversion_treats_equivalent_amounts_as_verified():
    # "110 මිලියන" and "කෝටි 11" are the same value (110,000,000) written
    # two ways -- this must NOT be flagged as a mismatch.
    article = "රජය රුපියල් මිලියන 110ක් වෙන් කර ඇත."
    headline = "රුපියල් කෝටි 11ක් වෙන් කිරීමට රජයෙන් තීරණය"
    assert unverified_numbers(article, headline) == []


def test_unit_conversion_catches_the_10x_money_error():
    # The documented v19 failure: article says USD 10 billion, generated
    # headline says the equivalent of USD 1 billion ("ඩොලර් මිලියන 1,000").
    article = "පාකිස්ථානය ඇමෙරිකාවෙන් ඩොලර් බිලියන 10ක හදිසි සහනයක් ඉල්ලා ඇත."
    headline = "පාකීස්තානයට ඩොලර් මිලියන 1,000 ක් ඉල්ලයි"
    assert unverified_numbers(article, headline) == ["1,000"]


def test_no_numbers_in_headline_is_trivially_verified():
    article = "රජය නව ප්‍රතිපත්තියක් ප්‍රකාශයට පත් කළේය."
    headline = "රජයෙන් නව ප්‍රතිපත්තියක්"
    assert unverified_numbers(article, headline) == []


def test_unverified_words_flags_content_word_absent_from_article():
    article = "කොළඹ නගරයේ රථවාහන තදබදයක් ඇති විය."
    headline = "ගාල්ලේ රථවාහන තදබදයක්"
    assert "ගාල්ලේ" in unverified_words(article, headline)


def test_unverified_words_ignores_common_function_words():
    article = "කොළඹ නගරයේ රථවාහන තදබදයක් ඇති විය."
    headline = "කොළඹ නගරයේ රථවාහන තදබදයක් ඇති විය"
    assert unverified_words(article, headline) == []


def test_check_headline_bundles_both_signals():
    article = "වීරවිල ප්‍රදේශයේ බස් අනතුරකින් පුද්ගලයින් 19 දෙනෙකුට තුවාල සිදුවිය."
    result = check_headline(article, "බස් අනතුරින් 10කට තුවාල")
    assert result.numbers_verified is False
    assert result.unverified_numbers == ["10"]
