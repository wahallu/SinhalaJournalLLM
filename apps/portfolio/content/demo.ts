import type { ToolId } from "./tools";

/**
 * Example inputs and outputs for the homepage demo.
 *
 * IMPORTANT: these are ILLUSTRATIVE. They were written by hand to show the
 * kind of result each tool gives; they are not captured model output, and the
 * site labels them that way. Have a native Sinhala speaker on the team review
 * the Sinhala text before publishing. English glosses are approximate and are
 * there for readers who do not read Sinhala.
 *
 * The style rewriter only shows the two styles we have example text for
 * (formal and editorial); the product has five.
 */

/** Text split into runs so a changed word can be highlighted. */
export interface Run {
  text: string;
  /** Marks a word that was corrected (input side) or is the correction (output side). */
  changed?: boolean;
}

export interface DemoExample {
  id: string;
  label: string;
  /** Sinhala source text. */
  input: Run[];
  inputGloss: string;
  /** One or more Sinhala outputs (headline options, bullets, or a single text). */
  outputs: { runs: Run[]; gloss: string }[];
  /** What the visitor should notice, in plain English. */
  note: string;
}

const plain = (text: string): Run[] => [{ text }];

export const DEMO_TOOLS: {
  id: ToolId;
  label: string;
  outputLabel: string;
  examples: DemoExample[];
}[] = [
  {
    id: "grammar",
    label: "Grammar",
    outputLabel: "Corrected text",
    examples: [
      {
        id: "grammar-1",
        label: "Verb endings",
        input: [
          { text: "ජනාධිපතිවරයා ඊයේ පැවති සමුළුවේදී නව ජාතික ප්‍රතිපත්තිය " },
          { text: "ප්‍රකාශ කළාය", changed: true },
          { text: ". සියලු මන්ත්‍රීවරුන් ඊට " },
          { text: "සහභාගී විය", changed: true },
          { text: "." },
        ],
        inputGloss:
          "The President announced the new national policy at yesterday’s summit. All the MPs attended it.",
        outputs: [
          {
            runs: [
              { text: "ජනාධිපතිවරයා ඊයේ පැවති සමුළුවේදී නව ජාතික ප්‍රතිපත්තිය " },
              { text: "ප්‍රකාශ කළේය", changed: true },
              { text: ". සියලු මන්ත්‍රීවරුන් ඊට " },
              { text: "සහභාගී වූහ", changed: true },
              { text: "." },
            ],
            gloss: "Same meaning; two verb endings corrected.",
          },
        ],
        note: "Two verb endings were corrected so each verb agrees with its subject. The rest of the text is untouched.",
      },
      {
        id: "grammar-2",
        label: "Plural agreement",
        input: [
          { text: "ප්‍රවෘත්ති වාර්තාකරුවන් එම සිදුවීම පිළිබඳව තොරතුරු සෙවීමට " },
          { text: "පටන් ගත්තේය", changed: true },
          { text: "." },
        ],
        inputGloss:
          "News reporters began to look for information about that incident.",
        outputs: [
          {
            runs: [
              { text: "ප්‍රවෘත්ති වාර්තාකරුවන් එම සිදුවීම පිළිබඳව තොරතුරු සෙවීමට " },
              { text: "පටන් ගත්හ", changed: true },
              { text: "." },
            ],
            gloss: "Same meaning; the verb now agrees with the plural subject.",
          },
        ],
        note: "One verb ending was corrected to match a plural subject.",
      },
    ],
  },
  {
    id: "headlines",
    label: "Headlines",
    outputLabel: "Headline options",
    examples: [
      {
        id: "headline-1",
        label: "Central bank report",
        input: plain(
          "ශ්‍රී ලංකා මහ බැංකුව විසින් ප්‍රකාශයට පත් කරන ලද නවතම වාර්තාවට අනුව මෙරට උද්ධමනය තනි අංකයක මට්ටමකට පහත වැටී ඇති අතර විදේශ විනිමය සංචිතය ඩොලර් බිලියන 6 ඉක්මවා වර්ධනය වී තිබේ.",
        ),
        inputGloss:
          "According to the Central Bank’s latest report, inflation has fallen to a single-digit level and foreign exchange reserves have grown beyond USD 6 billion.",
        outputs: [
          {
            runs: plain(
              "උද්ධමනය තනි අංකයට පහත බසී: විදේශ සංචිත ඩොලර් බිලියන 6 සීමාව ඉක්මවයි",
            ),
            gloss:
              "Inflation falls to a single digit: foreign reserves pass USD 6 billion.",
          },
          {
            runs: plain(
              "ශ්‍රී ලංකා ආර්ථිකයේ ප්‍රබල පිබිදීමක්: මහ බැංකු වාර්තාවෙන් හෙළිවන නවතම තතු",
            ),
            gloss:
              "A strong revival for the Sri Lankan economy: the latest details from the Central Bank report.",
          },
        ],
        note: "You get several options, each with a different angle. Numbers in a headline are checked against the article, and anything that does not match is flagged for you to review.",
      },
    ],
  },
  {
    id: "style",
    label: "Style",
    outputLabel: "Rewritten text",
    examples: [
      {
        id: "style-formal",
        label: "Formal news",
        input: plain(
          "කාලගුණ විද්‍යා දෙපාර්තමේන්තුව පවසන්නේ ඉදිරි පැය 24 තුළ දිවයිනේ ප්‍රදේශ කිහිපයකට තද වැසි ඇතිවිය හැකි බවයි.",
        ),
        inputGloss:
          "The Meteorology Department says heavy rain may occur in several parts of the island in the next 24 hours.",
        outputs: [
          {
            runs: plain(
              "කාලගුණ විද්‍යා දෙපාර්තමේන්තුව විසින් නිකුත් කරන ලද නිල නිවේදනයට අනුව ඉදිරි පැය විසිහතරක කාලසීමාව තුළ දිවයිනේ දිස්ත්‍රික්ක කිහිපයකට සැලකිය යුතු වර්ෂාපතනයක් අපේක්ෂා කෙරේ.",
            ),
            gloss:
              "According to an official announcement from the Meteorology Department, significant rainfall is expected in several districts within the next twenty-four hours.",
          },
        ],
        note: "Rewritten in a formal news register.",
      },
      {
        id: "style-editorial",
        label: "Editorial",
        input: plain(
          "කාලගුණ විද්‍යා දෙපාර්තමේන්තුව පවසන්නේ ඉදිරි පැය 24 තුළ දිවයිනේ ප්‍රදේශ කිහිපයකට තද වැසි ඇතිවිය හැකි බවයි.",
        ),
        inputGloss:
          "The Meteorology Department says heavy rain may occur in several parts of the island in the next 24 hours.",
        outputs: [
          {
            runs: plain(
              "වායුගෝලීය තත්ත්වයන් ගැඹුරින් විශ්ලේෂණය කරමින් කාලගුණ විද්‍යා දෙපාර්තමේන්තුව පෙන්වා දෙන්නේ ඉදිරි පැය 24 තුළ තද වැසි ඇතිවීමේ ඉහළ සම්භාවිතාවක් පවතින බවයි.",
            ),
            gloss:
              "Analysing atmospheric conditions closely, the Meteorology Department points out that there is a high probability of heavy rain in the next 24 hours.",
          },
        ],
        note: "The same story in a more analytical, opinion-page voice. The app offers five styles: formal, sports, youth, editorial and feature.",
      },
    ],
  },
  {
    id: "summaries",
    label: "Summary",
    outputLabel: "Summary",
    examples: [
      {
        id: "summary-1",
        label: "Renewable energy plan",
        input: plain(
          "ශ්‍රී ලංකාවේ පුනර්ජනනීය බලශක්ති ව්‍යාපෘති කඩිනම් කිරීම සඳහා රජය නව ජාතික සැලැස්මක් ප්‍රකාශයට පත් කර ඇත. සූර්ය හා සුළං බලශක්තිය මඟින් ජාතික විදුලිබල පද්ධතියට මෙගාවොට් 1000ක් එක් කිරීමට සැලසුම් කර ඇති අතර, එමගින් පරිසර දූෂණය අවම කර ගනිමින් ඉන්ධන ආනයන වියදම් විශාල ලෙස ඉතිරි කර ගැනීමට හැකි වනු ඇතැයි බලශක්ති අමාත්‍යාංශය අවධාරණය කරයි.",
        ),
        inputGloss:
          "The government has announced a new national plan to speed up renewable energy projects. Solar and wind power are planned to add 1,000 MW to the national grid, and the Ministry of Energy stresses this would cut pollution and greatly reduce fuel import costs.",
        outputs: [
          {
            runs: plain(
              "පුනර්ජනනීය බලශක්තිය කඩිනම් කිරීමට රජයෙන් නව ජාතික සැලැස්මක් ප්‍රකාශයට පත් කෙරේ.",
            ),
            gloss: "The government announces a new national plan to speed up renewable energy.",
          },
          {
            runs: plain(
              "සූර්ය හා සුළං බලයෙන් ජාතික විදුලි පද්ධතියට මෙගාවොට් 1000ක් එක් කිරීමේ ඉලක්කයක්.",
            ),
            gloss: "A target of adding 1,000 MW to the national grid from solar and wind.",
          },
          {
            runs: plain(
              "පරිසර දූෂණය පාලනය කරමින් ඉන්ධන ආනයන වියදම් සැලකිය යුතු ලෙස ඉතිරි කිරීමට පියවර.",
            ),
            gloss: "Steps to control pollution while cutting fuel import costs significantly.",
          },
        ],
        note: "A long article becomes three short points that keep the key facts and numbers.",
      },
    ],
  },
];
