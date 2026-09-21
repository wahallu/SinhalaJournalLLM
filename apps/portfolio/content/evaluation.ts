import type { ToolId } from "./tools";

/**
 * Human evaluation of SinAi, from the team's Google Form export
 * ("human eval results.xlsx").
 *
 *   n        13 respondents
 *   period   27–31 August 2026
 *   scale    1 (strongly disagree) … 5 (strongly agree)
 *
 * `counts` is how many respondents chose 1, 2, 3, 4, 5 for that statement.
 * Means and percentages are always derived from `counts` (see helpers below),
 * never typed in, so they cannot drift from the raw data.
 *
 * This is a small, self-selected pilot. It reports early impressions and is
 * not a controlled study; the pages that show it say so.
 */
export type Counts = [number, number, number, number, number];

export interface Statement {
  id: string;
  /** Short label for charts. */
  label: string;
  /** Exact wording shown to respondents. */
  text: string;
  tool: ToolId | "overall";
  counts: Counts;
}

export const EVAL_META = {
  n: 13,
  period: "27–31 August 2026",
  source: "SinAi user evaluation form (Google Forms), 13 responses",
  scale: "1 = strongly disagree, 5 = strongly agree",
} as const;

export const RESPONDENT_ROLES = [
  { label: "Journalism students", count: 5 },
  { label: "Editors", count: 4 },
  { label: "School teachers", count: 2 },
  { label: "Other students", count: 2 },
] as const;

export const RESPONDENT_FREQUENCY = [
  { label: "Daily", count: 5 },
  { label: "Several times a week", count: 5 },
  { label: "Sometimes", count: 2 },
  { label: "Rarely", count: 1 },
] as const;

export const STATEMENTS: Statement[] = [
  {
    id: "grammar-found",
    label: "Found the grammar errors",
    text: "The system correctly found grammar errors.",
    tool: "grammar",
    counts: [1, 0, 1, 5, 6],
  },
  {
    id: "grammar-fixes",
    label: "Corrections were correct and useful",
    text: "The suggested corrections were correct and useful.",
    tool: "grammar",
    counts: [0, 0, 2, 4, 7],
  },
  {
    id: "grammar-useful",
    label: "Useful for journalism work",
    text: "The grammar checker is useful for journalism work.",
    tool: "grammar",
    counts: [0, 1, 1, 3, 8],
  },
  {
    id: "summary-points",
    label: "Included the main points",
    text: "The summary included the main points of the news article.",
    tool: "summaries",
    counts: [1, 0, 0, 5, 7],
  },
  {
    id: "summary-clear",
    label: "Clear and easy to understand",
    text: "The summary was clear and easy to understand.",
    tool: "summaries",
    counts: [0, 1, 0, 6, 6],
  },
  {
    id: "summary-useful",
    label: "Useful for journalism work",
    text: "The summarizer is useful for journalism work.",
    tool: "summaries",
    counts: [0, 0, 1, 6, 6],
  },
  {
    id: "headline-match",
    label: "Matched the article",
    text: "The generated headline matched the news article.",
    tool: "headlines",
    counts: [1, 0, 0, 7, 5],
  },
  {
    id: "headline-suitable",
    label: "Suitable for a news article",
    text: "The generated headline was suitable for a news article.",
    tool: "headlines",
    counts: [0, 1, 2, 5, 5],
  },
  {
    id: "headline-useful",
    label: "Useful for journalism work",
    text: "The headline generator is useful for journalism work.",
    tool: "headlines",
    counts: [0, 0, 1, 4, 8],
  },
  {
    id: "style-meaning",
    label: "Kept the original meaning",
    text: "The rewritten text kept the original meaning.",
    tool: "style",
    counts: [1, 0, 1, 5, 6],
  },
  {
    id: "style-natural",
    label: "Natural and professional",
    text: "The rewritten text was natural and professional.",
    tool: "style",
    counts: [0, 0, 3, 4, 6],
  },
  {
    id: "style-useful",
    label: "Useful for journalism work",
    text: "The style rewriter is useful for journalism work.",
    tool: "style",
    counts: [0, 0, 2, 4, 7],
  },
  {
    id: "overall-easy",
    label: "Easy to use",
    text: "The system was easy to use.",
    tool: "overall",
    counts: [0, 1, 0, 5, 7],
  },
  {
    id: "overall-useful",
    label: "Useful for journalism-related tasks",
    text: "The system was useful for journalism-related tasks.",
    tool: "overall",
    counts: [0, 1, 0, 5, 7],
  },
];

export const total = (c: Counts) => c.reduce((a, b) => a + b, 0);

/** Mean rating on the 1–5 scale. */
export const mean = (c: Counts) =>
  c.reduce((sum, n, i) => sum + n * (i + 1), 0) / total(c);

/** Respondents who chose 4 or 5. */
export const agreeCount = (c: Counts) => c[3] + c[4];

export const agreePct = (c: Counts) => Math.round((agreeCount(c) / total(c)) * 100);

export const byTool = (tool: Statement["tool"]) =>
  STATEMENTS.filter((s) => s.tool === tool);

/** The "useful for journalism work" statement for each tool, for summary charts. */
export const usefulness = (tool: Exclude<Statement["tool"], "overall">) =>
  STATEMENTS.find((s) => s.tool === tool && s.id.endsWith("-useful"))!;

export const OVERALL_USEFUL = STATEMENTS.find((s) => s.id === "overall-useful")!;
export const OVERALL_EASY = STATEMENTS.find((s) => s.id === "overall-easy")!;

/** True when every statement drew at least one rating of 3 or below. */
export const everyStatementHadALowRating = STATEMENTS.every(
  (s) => s.counts[0] + s.counts[1] + s.counts[2] > 0,
);
