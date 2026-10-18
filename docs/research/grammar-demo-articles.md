# Grammar demo articles (journal rules layer)

Three news articles seeded with spelling **and** grammar errors for demonstrating the grammar checker. Paste an **Input** block into the Grammar Checker. Every error in the answer key is fixed by the deterministic rule layer (`apps/backend-api/app/services/grammar/journal_rules.py`), even if the model changes nothing. `apps/backend-api/tests/test_journal_rules.py` checks that each input becomes exactly the expected text, and that the expected text is returned unchanged.

In the corrected text, grammar edits are highlighted **orange** and spelling edits **yellow**. Hover or click a highlight to see the rule that made it.

How the rules were chosen, how often each one fires on 1M published news sentences, and which rules were rejected: see `grammar-journal-rules.md`.

## What the layer covers

| Rule ID | Grammar concept | Example |
|---|---|---|
| `GRAM_CASE_DATIVE_001` | Case marking (විභක්ති): warn/advise/inform → dative -ට | ජනතාවගෙන් අනතුරු ඇඟවීය → ජනතාවට අනතුරු ඇඟවීය |
| `GRAM_CASE_ABLATIVE_001` | Case marking (විභක්ති): request/question → ablative -ගෙන් | ප්‍රදේශවාසීන්ට ඉල්ලා සිටියේය → ප්‍රදේශවාසීන්ගෙන් ඉල්ලා සිටියේය |
| `GRAM_CASE_ATTACH_001` | Case suffix (විභක්ති ප්‍රත්‍ය) is bound to its noun | පාසල් වල → පාසල්වල; ජාතිකයන් ගේ → ජාතිකයන්ගේ |
| `GRAM_AGR_001` | Subject–verb agreement (උක්ත–ආඛ්‍යාත): number and gender, past and present | නිලධාරීහු … කළේය → කළහ; නීතිඥවරිය … සිටියේය → සිටියාය; ගුරුවරු … දෙයි → දෙති |
| `GRAM_REGISTER_001` | Register (ලිඛිත ව්‍යවහාරය): written plural subject + spoken verb | ප්‍රදේශවාසීහු පැවසුවා → ප්‍රදේශවාසීහු පැවසූහ |
| `GRAM_VOICE_001` | Voice (කර්ම කාරක): විසින් agent needs a passive verb | … විසින් අත්අඩංගුවට ගත්තේය → ගන්නා ලදී |
| `GRAM_VOICE_002` | Voice (කර්තෘ කාරක): active speech verb takes no විසින් | … දෙපාර්තමේන්තුව විසින් පැවසීය → දෙපාර්තමේන්තුව පැවසීය |
| `GRAM_TENSE_001` | Tense (කාල භේදය): time word sets tense | ඊයේ … කරනු ඇත → කළේය; හෙට … විය → වනු ඇත |
| `GRAM_CLEFT_FOCUS_001` | Focus sentence (අවධාරණ වාක්‍ය): closing participle takes -මිනි | මේ බව පැවසුවේ … මෙහෙයවමින් → මෙහෙයවමිනි |
| `GRAM_CLAUSE_001` | Reported clause (වාර්තා වාක්‍ය): focused reporting verb closes with බවයි | අවධාරණය කළේ … වගකීමක් → … වගකීමක් බවයි |
| `SPELL_JOURNAL_001` | Spelling: a short curated list | බරපතල → බරපතළ, අධිකරනය → අධිකරණය |

## Article 1: අධිකරණ පුවත — මාධ්‍යවේදියා අතුරුදන් කිරීමේ නඩුව

**11 errors: 9 grammar, 2 spelling.**

### Input (paste this)

```text
මාධ්‍යවේදියෙකු අතුරුදන් කිරීමේ නඩුව සම්බන්ධයෙන් කොළඹ මහාධිකරණයේ ත්‍රිපුද්ගල විනිසුරු මඩුල්ල ඊයේ (16) සාක්ෂි විභාගය ආරම්භ කරනු ඇත.

චූදිතයා තමා සමඟ කිහිප වතාවක් සාකච්ඡා පැවැත්වූ බව නඩුවේ ප්‍රධාන සාක්ෂිකරු විසින් අධිකරනයේදී පැවසීය.

නියෝජ්‍ය සොලිසිටර් ජනරාල්වරයා සාක්ෂිකරුට ප්‍රශ්න කළේ චූදිතයා සමඟ අවසන් වරට කතා කළේ කවදාද යන්නයි.

සාක්ෂිකරු අධිකරණයෙන් පිටව යද්දී ඔහුගෙන් මාධ්‍යවේදීන් කිහිප දෙනෙක් ප්‍රශ්න කළහ.

පසුගිය වසරේ මෙම නඩුවට අදාළ සැකකරුවන් හතර දෙනෙකු අපරාධ පරීක්ෂණ දෙපාර්තමේන්තුව විසින් අත්අඩංගුවට ගත්තේය.

විත්තියේ නීතිඥවරිය අවධාරණය කළේ සාක්ෂිකරුගේ ප්‍රකාෂය පරස්පර විරෝධතා වලින් පිරි සාක්ෂියක්.

එබැවින් සාක්ෂිකරුගේ සාක්ෂි නැවත සලකා බලන ලෙස විත්තියේ නීතිඥවරිය අධිකරණයෙන් ඉල්ලා සිටියේය.

නියෝජ්‍ය සොලිසිටර් ජනරාල්වරයා මේ බව පැවසුවේ ප්‍රධාන සාක්ෂිකරුගේ සාක්ෂි මෙහෙයවමින්.

විනිසුරුවරු නඩුව ලබන සතියේ නැවත කැඳවීමට නියෝග කළේය.
```

### Expected output

```text
මාධ්‍යවේදියෙකු අතුරුදන් කිරීමේ නඩුව සම්බන්ධයෙන් කොළඹ මහාධිකරණයේ ත්‍රිපුද්ගල විනිසුරු මඩුල්ල ඊයේ (16) සාක්ෂි විභාගය ආරම්භ කළේය.

චූදිතයා තමා සමඟ කිහිප වතාවක් සාකච්ඡා පැවැත්වූ බව නඩුවේ ප්‍රධාන සාක්ෂිකරු අධිකරණයේදී පැවසීය.

නියෝජ්‍ය සොලිසිටර් ජනරාල්වරයා සාක්ෂිකරුගෙන් ප්‍රශ්න කළේ චූදිතයා සමඟ අවසන් වරට කතා කළේ කවදාද යන්නයි.

සාක්ෂිකරු අධිකරණයෙන් පිටව යද්දී ඔහුගෙන් මාධ්‍යවේදීන් කිහිප දෙනෙක් ප්‍රශ්න කළහ.

පසුගිය වසරේ මෙම නඩුවට අදාළ සැකකරුවන් හතර දෙනෙකු අපරාධ පරීක්ෂණ දෙපාර්තමේන්තුව විසින් අත්අඩංගුවට ගන්නා ලදී.

විත්තියේ නීතිඥවරිය අවධාරණය කළේ සාක්ෂිකරුගේ ප්‍රකාශය පරස්පර විරෝධතාවලින් පිරි සාක්ෂියක් බවයි.

එබැවින් සාක්ෂිකරුගේ සාක්ෂි නැවත සලකා බලන ලෙස විත්තියේ නීතිඥවරිය අධිකරණයෙන් ඉල්ලා සිටියාය.

නියෝජ්‍ය සොලිසිටර් ජනරාල්වරයා මේ බව පැවසුවේ ප්‍රධාන සාක්ෂිකරුගේ සාක්ෂි මෙහෙයවමිනි.

විනිසුරුවරු නඩුව ලබන සතියේ නැවත කැඳවීමට නියෝග කළහ.
```

### Answer key

| # | Rule | Error | Correction | Why |
|---|---|---|---|---|
| 1 | `GRAM_TENSE_001` | ඊයේ … ආරම්භ කරනු ඇත | ඊයේ … ආරම්භ කළේය | ඊයේ (yesterday) needs a past-tense verb, not the future කරනු ඇත. |
| 2 | `GRAM_VOICE_002` | සාක්ෂිකරු විසින් … පැවසීය | සාක්ෂිකරු … පැවසීය | විසින් marks the agent of a passive verb; පැවසීය is active, so the subject takes no marker. |
| 3 | `SPELL_JOURNAL_001` | අධිකරනයේදී | අධිකරණයේදී | Spelling: මූර්ධජ ණ. |
| 4 | `GRAM_CASE_ABLATIVE_001` | සාක්ෂිකරුට ප්‍රශ්න කළේ | සාක්ෂිකරුගෙන් ප්‍රශ්න කළේ | Questioning someone takes the ablative -ගෙන් (asked from), not the dative -ට. |
| 5 | `GRAM_VOICE_001` | සැකකරුවන් හතර දෙනෙකු … විසින් අත්අඩංගුවට ගත්තේය | … විසින් අත්අඩංගුවට ගන්නා ලදී | An agent marked with විසින් requires a passive predicate (ගන්නා ලදී). |
| 6 | `SPELL_JOURNAL_001` | ප්‍රකාෂය | ප්‍රකාශය | Spelling: තාලුජ ශ. |
| 7 | `GRAM_CASE_ATTACH_001` | විරෝධතා වලින් | විරෝධතාවලින් | -වලින් is a bound case ending (plural instrumental), written joined to its noun. |
| 8 | `GRAM_CLAUSE_001` | අවධාරණය කළේ … සාක්ෂියක්. | අවධාරණය කළේ … සාක්ෂියක් බවයි. | The focused reporting verb කළේ opens a reported clause that must be closed with බවයි. |
| 9 | `GRAM_AGR_001` | නීතිඥවරිය … ඉල්ලා සිටියේය | නීතිඥවරිය … ඉල්ලා සිටියාය | Gender agreement: a feminine subject takes the feminine ending -ාය. |
| 10 | `GRAM_CLEFT_FOCUS_001` | මේ බව පැවසුවේ … මෙහෙයවමින්. | මේ බව පැවසුවේ … මෙහෙයවමිනි. | In a focus (cleft) sentence the focused closing participle takes the emphatic ending -මිනි. No බවයි is added, because මේ බව already names what was said. |
| 11 | `GRAM_AGR_001` | විනිසුරුවරු … නියෝග කළේය | විනිසුරුවරු … නියෝග කළහ | Number agreement: a plural subject takes the plural ending -හ. ලබන සතියේ belongs to කැඳවීමට, so the past tense stays. |

**Control sentences (correct as written; nothing changes):** සාක්ෂිකරු අධිකරණයෙන් පිටව යද්දී ඔහුගෙන් මාධ්‍යවේදීන් කිහිප දෙනෙක් ප්‍රශ්න කළහ.

## Article 2: කාලගුණ පුවත — අධික වර්ෂාව සහ ගංවතුර අවදානම

**12 errors: 10 grammar, 2 spelling.**

### Input (paste this)

```text
නිරිතදිග මෝසම් තත්ත්වය හේතුවෙන් රටේ ප්‍රදේශ කිහිපයකට හෙට සිට අධික වර්ෂාපතනයක් ඇති විය.

ආපදා කළමනාකරණ මධ්‍යස්ථානය ගංගා ආශ්‍රිත පහත් බිම් වල ජීවත් වන ජනතාවගෙන් අනතුරු ඇඟවීය.

නායයෑමේ අවදානම පිළිබඳව ජාතික ගොඩනැගිලි පර්යේෂණ සංවිධානයේ නිලධාරීහු ද අවධානය යොමු කළේය.

පසුගිය පැය 24 තුළ පමණක් නිවාස 120කට බරපතල හානි සිදු වූ අතර, පවුල් 3000කට අධික ප්‍රමාණයක් අවතැන් වී ඇත.

අවතැන් වූ පවුල් සඳහා ප්‍රදේශයේ පාසල් හතරක තාවකාලික නවාතැන් සපයා ඇති බව ප්‍රදේශවාසීහු පැවසුවා.

අවතැන් වූවන්ට අවශ්‍ය වියළි ආහාර සලාක ප්‍රාදේශීය ලේකම් කාර්යාලය විසින් ලබා දුන්හ.

ජලය බැස යන තෙක් ආරක්ෂිත ස්ථානවල රැඳී සිටින ලෙස ආපදා නිලධාරීහු ප්‍රදේශවාසීන්ට ඉල්ලා සිටියේය.

ධීවරයින් මුහුදු යාමෙන් වැළකී සිටිය යුතු බව කාලගුණ විද්‍යා දෙපාර්තමේන්තුව විසින් පැවසීය.

ආපදා කළමනාකරණ රාජ්‍ය අමාත්‍යාන්ශය ලබන සතියේ හානි තක්සේරු කිරීමේ වැඩසටහනක් ආරම්භ කළේය.
```

### Expected output

```text
නිරිතදිග මෝසම් තත්ත්වය හේතුවෙන් රටේ ප්‍රදේශ කිහිපයකට හෙට සිට අධික වර්ෂාපතනයක් ඇති වනු ඇත.

ආපදා කළමනාකරණ මධ්‍යස්ථානය ගංගා ආශ්‍රිත පහත් බිම්වල ජීවත් වන ජනතාවට අනතුරු ඇඟවීය.

නායයෑමේ අවදානම පිළිබඳව ජාතික ගොඩනැගිලි පර්යේෂණ සංවිධානයේ නිලධාරීහු ද අවධානය යොමු කළහ.

පසුගිය පැය 24 තුළ පමණක් නිවාස 120කට බරපතළ හානි සිදු වූ අතර, පවුල් 3000කට අධික ප්‍රමාණයක් අවතැන් වී ඇත.

අවතැන් වූ පවුල් සඳහා ප්‍රදේශයේ පාසල් හතරක තාවකාලික නවාතැන් සපයා ඇති බව ප්‍රදේශවාසීහු පැවසූහ.

අවතැන් වූවන්ට අවශ්‍ය වියළි ආහාර සලාක ප්‍රාදේශීය ලේකම් කාර්යාලය විසින් ලබා දෙන ලදී.

ජලය බැස යන තෙක් ආරක්ෂිත ස්ථානවල රැඳී සිටින ලෙස ආපදා නිලධාරීහු ප්‍රදේශවාසීන්ගෙන් ඉල්ලා සිටියහ.

ධීවරයින් මුහුදු යාමෙන් වැළකී සිටිය යුතු බව කාලගුණ විද්‍යා දෙපාර්තමේන්තුව පැවසීය.

ආපදා කළමනාකරණ රාජ්‍ය අමාත්‍යාංශය ලබන සතියේ හානි තක්සේරු කිරීමේ වැඩසටහනක් ආරම්භ කරනු ඇත.
```

### Answer key

| # | Rule | Error | Correction | Why |
|---|---|---|---|---|
| 1 | `GRAM_TENSE_001` | හෙට සිට … ඇති විය | හෙට සිට … ඇති වනු ඇත | හෙට (tomorrow) needs a future verb, not the past විය. |
| 2 | `GRAM_CASE_ATTACH_001` | බිම් වල | බිම්වල | -වල is a bound plural case ending, written joined to its noun. |
| 3 | `GRAM_CASE_DATIVE_001` | ජනතාවගෙන් අනතුරු ඇඟවීය | ජනතාවට අනතුරු ඇඟවීය | The person warned is dative (-ට); -ගෙන් would mean warned from the people. |
| 4 | `GRAM_AGR_001` | නිලධාරීහු ද … යොමු කළේය | නිලධාරීහු ද … යොමු කළහ | Number agreement: plural subject නිලධාරීහු takes -හ. |
| 5 | `SPELL_JOURNAL_001` | බරපතල | බරපතළ | Spelling: මූර්ධජ ළ. |
| 6 | `GRAM_REGISTER_001` | ප්‍රදේශවාසීහු පැවසුවා | ප්‍රදේශවාසීහු පැවසූහ | The written plural subject (-හු) needs the written plural verb; පැවසුවා is the spoken form. |
| 7 | `GRAM_VOICE_001` | කාර්යාලය විසින් ලබා දුන්හ | කාර්යාලය විසින් ලබා දෙන ලදී | An agent marked with විසින් requires a passive predicate. |
| 8 | `GRAM_CASE_ABLATIVE_001` | ප්‍රදේශවාසීන්ට ඉල්ලා සිටියේය | ප්‍රදේශවාසීන්ගෙන් ඉල්ලා සිටියහ | Requesting from someone takes the ablative -ගෙන්. |
| 9 | `GRAM_AGR_001` | නිලධාරීහු … ඉල්ලා සිටියේය | නිලධාරීහු … ඉල්ලා සිටියහ | Number agreement in the same sentence: plural subject takes -හ. |
| 10 | `GRAM_VOICE_002` | දෙපාර්තමේන්තුව විසින් පැවසීය | දෙපාර්තමේන්තුව පැවසීය | An active speech verb takes a plain subject, not the passive agent marker විසින්. |
| 11 | `SPELL_JOURNAL_001` | අමාත්‍යාන්ශය | අමාත්‍යාංශය | Spelling: අනුස්වාරය (ං). |
| 12 | `GRAM_TENSE_001` | ලබන සතියේ … ආරම්භ කළේය | ලබන සතියේ … ආරම්භ කරනු ඇත | ලබන සතියේ (next week) needs a future verb. |

**Control sentences (correct as written; nothing changes):** පසුගිය පැය 24 තුළ පමණක් නිවාස 120කට … පවුල් 3000කට අධික ප්‍රමාණයක් අවතැන් වී ඇත. (only බරපතල changes)

## Article 3: සෞඛ්‍ය පුවත — ඩෙංගු රෝගීන් ඉහළ යාම

**12 errors: 10 grammar, 2 spelling.**

### Input (paste this)

```text
පසුගිය සතියේ දිවයින පුරා ඩෙංගු රෝගීන් 1,200කට අධික සංඛ්‍යාවක් වාර්තා වනු ඇත.

මෙම රෝගීන්ගෙන් වැඩි පිරිසක් බරපතල රෝග ලක්ෂණ සහිතව බස්නාහිර පළාතෙන් වාර්තා වූ බව ජාතික ඩෙංගු මර්දන ඒකකයේ ප්‍රජා වෛද්‍ය විශේෂඥවරිය පැවසීය.

මහජන සෞඛ්‍ය පරීක්ෂකවරු ලබන සතියේ නිවෙස් පරීක්ෂා කිරීමේ වැඩසටහනක් ආරම්භ කළේය.

පසුගිය දින කිහිපය තුළ සිදු කළ පරීක්ෂණවලදී මදුරුවන් බෝවන ස්ථාන තබාගෙන සිටි නිවැසියන්ගෙන් සෞඛ්‍ය නිලධාරීහු අවවාද කළේය.

ඩෙංගු මර්දන වැඩසටහනට සහාය දෙන ලෙස සෞඛ්‍ය අමාත්‍යාංශය සියලු පාසල් වල ප්‍රධානීන්ට ඉල්ලා සිටියේය.

ඩෙංගු මර්දන කටයුතු සඳහා ප්‍රදේශයේ ගුරුවරු ද සහාය දෙයි.

උණ රෝග ලක්ෂණ දින දෙකකට වඩා පවතී නම් වහාම වෛද්‍ය උපදෙස් ලබා ගන්නා ලෙස සෞඛ්‍ය ප්‍රවර්ධන කාර්යාංශය මහජනතාවට දැනුම් දෙයි.

ඩෙංගු රෝගයෙන් මේ වසරේ මිය ගිය රෝගන්ගේ සංඛ්‍යාව 18ක් බව ද සෞඛ්‍ය අමාත්‍යාංශය විසින් කියා සිටියේය.

සෞඛ්‍ය බලධාරීහු අවධාරණය කළේ ඩෙංගු මර්දනය සමස්ත ප්‍රජාවේම වගකීමක්.
```

### Expected output

```text
පසුගිය සතියේ දිවයින පුරා ඩෙංගු රෝගීන් 1,200කට අධික සංඛ්‍යාවක් වාර්තා විය.

මෙම රෝගීන්ගෙන් වැඩි පිරිසක් බරපතළ රෝග ලක්ෂණ සහිතව බස්නාහිර පළාතෙන් වාර්තා වූ බව ජාතික ඩෙංගු මර්දන ඒකකයේ ප්‍රජා වෛද්‍ය විශේෂඥවරිය පැවසුවාය.

මහජන සෞඛ්‍ය පරීක්ෂකවරු ලබන සතියේ නිවෙස් පරීක්ෂා කිරීමේ වැඩසටහනක් ආරම්භ කරනු ඇත.

පසුගිය දින කිහිපය තුළ සිදු කළ පරීක්ෂණවලදී මදුරුවන් බෝවන ස්ථාන තබාගෙන සිටි නිවැසියන්ට සෞඛ්‍ය නිලධාරීහු අවවාද කළහ.

ඩෙංගු මර්දන වැඩසටහනට සහාය දෙන ලෙස සෞඛ්‍ය අමාත්‍යාංශය සියලු පාසල්වල ප්‍රධානීන්ගෙන් ඉල්ලා සිටියේය.

ඩෙංගු මර්දන කටයුතු සඳහා ප්‍රදේශයේ ගුරුවරු ද සහාය දෙති.

උණ රෝග ලක්ෂණ දින දෙකකට වඩා පවතී නම් වහාම වෛද්‍ය උපදෙස් ලබා ගන්නා ලෙස සෞඛ්‍ය ප්‍රවර්ධන කාර්යාංශය මහජනතාවට දැනුම් දෙයි.

ඩෙංගු රෝගයෙන් මේ වසරේ මිය ගිය රෝගීන්ගේ සංඛ්‍යාව 18ක් බව ද සෞඛ්‍ය අමාත්‍යාංශය කියා සිටියේය.

සෞඛ්‍ය බලධාරීහු අවධාරණය කළේ ඩෙංගු මර්දනය සමස්ත ප්‍රජාවේම වගකීමක් බවයි.
```

### Answer key

| # | Rule | Error | Correction | Why |
|---|---|---|---|---|
| 1 | `GRAM_TENSE_001` | පසුගිය සතියේ … වාර්තා වනු ඇත | පසුගිය සතියේ … වාර්තා විය | පසුගිය සතියේ (last week) needs a past verb. |
| 2 | `SPELL_JOURNAL_001` | බරපතල | බරපතළ | Spelling: මූර්ධජ ළ. |
| 3 | `GRAM_AGR_001` | විශේෂඥවරිය … පැවසීය | විශේෂඥවරිය … පැවසුවාය | Gender agreement: feminine subject takes -ාය. |
| 4 | `GRAM_TENSE_001` | ලබන සතියේ … ආරම්භ කළේය | ලබන සතියේ … ආරම්භ කරනු ඇත | ලබන සතියේ (next week) needs a future verb. |
| 5 | `GRAM_CASE_DATIVE_001` | නිවැසියන්ගෙන් … අවවාද | නිවැසියන්ට … අවවාද | The person advised/warned is dative -ට. |
| 6 | `GRAM_AGR_001` | නිලධාරීහු අවවාද කළේය | නිලධාරීහු අවවාද කළහ | Number agreement: plural subject takes -හ. |
| 7 | `GRAM_CASE_ATTACH_001` | පාසල් වල | පාසල්වල | -වල is a bound plural case ending, written joined to its noun. |
| 8 | `GRAM_CASE_ABLATIVE_001` | ප්‍රධානීන්ට ඉල්ලා සිටියේය | ප්‍රධානීන්ගෙන් ඉල්ලා සිටියේය | Requesting from someone takes the ablative -ගෙන්. The verb stays -ේය because the subject is අමාත්‍යාංශය (singular). |
| 9 | `GRAM_AGR_001` | ගුරුවරු ද සහාය දෙයි | ගුරුවරු ද සහාය දෙති | Present-tense number agreement: a plural subject takes -ති, a singular one -යි. |
| 10 | `SPELL_JOURNAL_001` | රෝගන්ගේ | රෝගීන්ගේ | Spelling/word form: රෝගී + න්. |
| 11 | `GRAM_VOICE_002` | අමාත්‍යාංශය විසින් කියා සිටියේය | අමාත්‍යාංශය කියා සිටියේය | An active speech verb takes a plain subject, not විසින්. |
| 12 | `GRAM_CLAUSE_001` | අවධාරණය කළේ … වගකීමක්. | අවධාරණය කළේ … වගකීමක් බවයි. | The focused reporting verb කළේ must close its reported clause with බවයි. |

**Control sentences (correct as written; nothing changes):** උණ රෝග ලක්ෂණ … සෞඛ්‍ය ප්‍රවර්ධන කාර්යාංශය මහජනතාවට දැනුම් දෙයි. · රෝගීන් 1,200කට අධික සංඛ්‍යාවක් (a comparison of quantity, so no දෙනා)

## Notes for the demo

- In article 1, `සාක්ෂිකරු විසින් අධිකරනයේදී` holds two errors next to each other. The corrections list shows them as one grammar correction.
- Deleting විසින් leaves nothing to highlight, so that fix appears only in the corrections count and list.
- The rules cover the constructions listed above and nothing else. See `grammar-journal-rules.md` for the measured firing rates and the limits. An admin can turn the layer off with `grammar.journal_rules_enabled` (Grammar Advanced). Turn it off for model-only evaluations.
