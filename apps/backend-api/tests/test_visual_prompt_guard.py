"""
Tests for app.services.headline.visual_prompt_guard -- the checks that hold
the generated image prompt to the article. The bad prompts below are quoted
from live output of the earlier free-form prompt writer on these same
articles (2026-10-18); see the module docstring.
"""

from app.services.headline.visual_prompt_guard import (
    Fact,
    find_issues,
    grounded_headline,
    is_grounded_source,
    verified_facts,
)

TRAFFIC = (
    "අධිවේගී මාර්ග ජාලයේ ස්ථාන කිහිපයක මේ වන විට දැඩි රථවාහන තදබදයක් හටගෙන ඇති බව "
    "මාර්ග සංවර්ධන අධිකාරිය පවසනවා.\n\n"
    "ඒ අනුව දක්ෂිණ අධිවේගී මාර්ගයේ මත්තල පිටවීම, පිටත වටරවුම් අධිවේගී මාර්ගයේ කඩවත "
    "පිටවීම මෙන්ම මධ්‍යම අධිවේගී මාර්ගයේ මීරිගම පිවිසුම සහ යග්ගපිටිය පිටවීම අසළ මෙලෙස "
    "වාහන තදබදය හටගෙන ඇති බවයි වාර්තා වෙන්නේ."
)
TRAFFIC_FACTS = [
    Fact("heavy traffic congestion on the expressway network",
         "අධිවේගී මාර්ග ජාලයේ ස්ථාන කිහිපයක මේ වන විට දැඩි රථවාහන තදබදයක්"),
    Fact("Mattala exit on the Southern Expressway", "දක්ෂිණ අධිවේගී මාර්ගයේ මත්තල පිටවීම"),
]

DROWNING = (
    "කල්පිටිය පොලිස් වසමේ ජනසවිපුර වෙරළ තීරයෙන් ඊයේ (24) මසුන් ඇල්ලීම සඳහා "
    "බෝට්ටුවකින් මුහුදු ගිය පුද්ගලයෙකු දියේ ගිලීමෙන් මියගොස් ඇතැයි පොලිසිය පවසනවා.\n"
    "මෙලෙස මියගොස් ඇත්තේ කල්පිටිය ප්‍රදේශයේ පදිංචි 56 හැවිරිදි පුද්ගලයෙක්."
)
DROWNING_FACTS = [
    Fact("Janasavipura beach, Kalpitiya", "ජනසවිපුර වෙරළ තීරයෙන්"),
    Fact("a 56-year-old man went to sea in a boat to fish",
         "56 හැවිරිදි පුද්ගලයෙක්"),
]

GUESTHOUSE = (
    "අම්බලන්ගොඩ නගර මධ්‍යයේ ලැගුම්හලක අබිරහස් අයුරින් මියගොස් සිටි පිරිමි අයෙකුගේ මළ "
    "සිරුරක් අද(25)දහවල් සොයා ගත් බව අම්බලන්ගොඩ පොලීසිය පවසනවා. මෙසේ සොයා ගනු "
    "ලැබූවේ අම්බලන්ගොඩ මහ පන්සල පාරේ ලැගුම්හලක තනිව ලැගුම් ගෙන සිටි හැටහත් හැවිරිදි "
    "රොහාන් ආරියතිලක නමැත්තාගේ බවත්."
)
GUESTHOUSE_FACTS = [
    Fact("a guesthouse on Maha Pansala Road in Ambalangoda town centre",
         "අම්බලන්ගොඩ මහ පන්සල පාරේ ලැගුම්හලක"),
    Fact("a 67-year-old man", "හැටහත් හැවිරිදි"),
]

MILAD = (
    "ජාතික මිලාද්-උන් උත්සවය ජනාධිපති අනුර කුමාර දිසානායකගේ ප්‍රධානත්වයෙන් අද (26) "
    "පස්වරු 3.00ට මීගමුව පෙරියමුල්ල අල්-හිලාල් විද්‍යාලයේදී පැවැත්වීමට නියමිතයි. "
    "උත්සවයට සමගාමීව ලේ දන්දීමේ කඳවුරක්, පැළ සිටුවීමේ වැඩසටහනක්, “Visit My Mosque” "
    "සංස්කෘතික වැඩසටහනක් ක්‍රියාත්මක කිරීමට නියමිතය."
)
MILAD_FACTS = [
    Fact("the National Milad-un-Nabi ceremony at Al-Hilal College, Periyamulla, Negombo",
         "මීගමුව පෙරියමුල්ල අල්-හිලාල් විද්‍යාලයේදී"),
    Fact("presided over by President Anura Kumara Dissanayake",
         "ජනාධිපති අනුර කුමාර දිසානායකගේ ප්‍රධානත්වයෙන්"),
    Fact("a blood donation camp", "ලේ දන්දීමේ කඳවුරක්"),
]
MILAD_PEOPLE = ["President Anura Kumara Dissanayake"]


def _quoted(issues: list[str]) -> list[str]:
    return [issue.split('"')[1] for issue in issues]


# ── Facts ──

def test_source_copied_from_article_is_grounded():
    assert is_grounded_source("දක්ෂිණ අධිවේගී මාර්ගයේ මත්තල පිටවීම", TRAFFIC)


def test_source_is_grounded_without_zero_width_joiners():
    # The model often drops the ZWJ inside conjuncts like ්‍ය.
    source = "මධ්‍යම අධිවේගී මාර්ගයේ".replace("‍", "")
    assert is_grounded_source(source, TRAFFIC)


def test_invented_or_translated_source_is_not_grounded():
    assert not is_grounded_source("මාතර අධිවේගී පිවිසුම අසල අනතුරක්", TRAFFIC)
    assert not is_grounded_source("Mattala exit on the Southern Expressway", TRAFFIC)


def test_fact_with_a_changed_number_is_dropped():
    wrong_age = Fact("a 57-year-old man", "56 හැවිරිදි පුද්ගලයෙක්")
    assert verified_facts([wrong_age, *DROWNING_FACTS], DROWNING) == DROWNING_FACTS


def test_age_written_in_words_grounds_its_digits():
    assert verified_facts(GUESTHOUSE_FACTS, GUESTHOUSE) == GUESTHOUSE_FACTS
    prompt = (
        "Photorealistic news photograph of the exterior of a guesthouse on Maha Pansala "
        "Road in Ambalangoda town centre, Sri Lanka, natural light, eye-level wide shot."
    )
    assert find_issues(prompt, GUESTHOUSE_FACTS, ["Rohan Ariyathilaka"], GUESTHOUSE) == []


# ── Headline ──

def test_headline_with_an_invented_number_is_not_used():
    assert grounded_headline(DROWNING, "කල්පිටියේ ධීවරයන් 3ක් දියේ ගිලී මියයයි") == ""


def test_grounded_headline_is_kept():
    headline = "කල්පිටියේ 56 හැවිරිදි පුද්ගලයෙක් දියේ ගිලී මියයයි"
    assert grounded_headline(DROWNING, headline) == headline


# ── Prompt checks: the live inaccuracies ──

def test_grounded_prompt_has_no_issues():
    prompt = (
        "Photorealistic news photograph of heavy traffic congestion at the Mattala exit "
        "of the Southern Expressway in Sri Lanka, vehicles queued on the expressway, "
        "natural light, wide shot from an elevated angle. No text, signs or logos."
    )
    assert find_issues(prompt, TRAFFIC_FACTS, [], TRAFFIC) == []


def test_flags_a_similar_better_known_place():
    prompt = "Rows of stalled cars on the southern expressway near Matara, natural light."
    assert _quoted(find_issues(prompt, TRAFFIC_FACTS, [], TRAFFIC)) == ["Matara"]


def test_flags_a_misspelt_place_name():
    prompt = "A fishing boat off the Janasaviya beach near Kalpitiya, natural light."
    assert _quoted(find_issues(prompt, DROWNING_FACTS, [], DROWNING)) == ["Janasaviya"]


def test_flags_a_real_person_but_allows_their_role():
    named = (
        "President Anura Kumara Dissanayake stands on a stage at Al-Hilal College "
        "in Periyamulla, Negombo."
    )
    assert _quoted(find_issues(named, MILAD_FACTS, MILAD_PEOPLE, MILAD)) == [
        "Anura", "Kumara", "Dissanayake",
    ]
    by_role = "Officials and the President at Al-Hilal College in Periyamulla, Negombo."
    assert find_issues(by_role, MILAD_FACTS, MILAD_PEOPLE, MILAD) == []


def test_flags_time_of_day_and_weather_the_article_does_not_state():
    prompt = (
        "The ceremony at Al-Hilal College under bright midday sunlight, with a clear "
        "blue sky."
    )
    assert _quoted(find_issues(prompt, MILAD_FACTS, MILAD_PEOPLE, MILAD)) == [
        "midday", "sunlight", "blue sky",
    ]


def test_allows_conditions_the_facts_state():
    facts = [*DROWNING_FACTS, Fact("in the morning", "ඊයේ (24)")]
    prompt = "A boat off Janasavipura beach in Kalpitiya in the morning, natural light."
    assert find_issues(prompt, facts, [], DROWNING) == []


def test_flags_invented_emotions_and_vague_ages():
    prompt = (
        "Frustrated drivers wait at the Mattala exit. A middle-aged man stands by the road."
    )
    assert _quoted(find_issues(prompt, TRAFFIC_FACTS, [], TRAFFIC)) == [
        "frustrated", "middle-aged",
    ]


def test_flags_text_in_the_image_but_not_a_negated_mention():
    prompt = (
        "The ceremony at Al-Hilal College with a large banner reading “Unity, "
        "Brotherhood, Co-existence.” Behind it, a tent."
    )
    issues = find_issues(prompt, MILAD_FACTS, MILAD_PEOPLE, MILAD)
    assert '"banner" -- the image must not contain text, signs, banners or logos' in issues
    assert any("quoted words" in issue for issue in issues)
    # The sentence after a closing quote starts fresh, so "Behind" isn't a name.
    assert not any(issue.startswith('"Behind"') for issue in issues)

    negated = "A tent at Al-Hilal College, natural light, no text, logos or watermarks."
    assert find_issues(negated, MILAD_FACTS, MILAD_PEOPLE, MILAD) == []


def test_flags_bodies_but_not_blood_donation_or_a_body_of_water():
    prompt = (
        "The lifeless body of a man floating face-up in the shallow water near "
        "Janasavipura beach."
    )
    assert "lifeless" in _quoted(find_issues(prompt, DROWNING_FACTS, [], DROWNING))

    # U+2011, as the model writes it.
    donation = "A blood‑donation camp at Al-Hilal College, natural light."
    assert find_issues(donation, MILAD_FACTS, MILAD_PEOPLE, MILAD) == []
    water = "A boat on a calm body of water off Janasavipura beach, natural light."
    assert find_issues(water, DROWNING_FACTS, [], DROWNING) == []


def test_flags_a_number_the_article_does_not_have():
    prompt = "Three fishing boats off Janasavipura beach and 12 fishermen, natural light."
    assert find_issues(prompt, DROWNING_FACTS, [], DROWNING) == [
        'the number "12" is not in the article'
    ]
