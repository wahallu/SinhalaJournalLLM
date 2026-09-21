/**
 * Free-text comments from the human evaluation form, verbatim and
 * attributed by the role the respondent selected, never by name.
 *
 * Source: SinAi user evaluation form, 13 responses, 27–31 August 2026.
 * Only 4 of the 13 respondents left a comment. All 4 are listed here; none
 * were left out or edited.
 */
export interface Quote {
  text: string;
  role: string;
}

export const QUOTES: Quote[] = [
  {
    text: "User friendly ui/ux design, very usable & features are perfect",
    role: "Editor",
  },
  { text: "Keep it up. Great platform.", role: "Journalism student" },
  { text: "Really really good!", role: "Editor" },
  { text: "Good work", role: "Engineering student" },
];

export const QUOTES_NOTE =
  "4 of 13 testers left a comment. All four are shown, word for word.";
