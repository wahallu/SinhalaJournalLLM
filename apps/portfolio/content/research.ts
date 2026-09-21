import type { ToolId } from "./tools";

/**
 * Every figure the site publishes about the research lives in this file, and
 * every figure carries a `source`. If you cannot fill in a source, the number
 * does not belong on the site.
 *
 * "Paper" = paper.tex, "SinhalaJournal-LLM: Data-Centric Adaptation of a
 * Sinhala Language Model for Journalism" (Research/paper.tex).
 */

// ── The data ────────────────────────────────────────────────────────────────

export const CORPUS = {
  collected: 1_031_456,
  kept: 665_887,
  removed: 365_569,
  removedPct: 35.4,
  span: "13 March 2008 – 4 March 2026",
  filters: [
    "Exact duplicate articles removed",
    "Article body between 300 and 10,000 characters",
    "Title between 10 and 200 characters",
    "At least 30% of characters are Sinhala Unicode",
  ],
  categories: [
    { name: "Local news", count: 264_434 },
    { name: "Politics", count: 151_640 },
    { name: "International", count: 68_005 },
    { name: "Business", count: 49_247 },
    { name: "Sports", count: 37_336 },
    { name: "Editorial", count: 16_263 },
    { name: "All other topics", count: 78_962 },
  ],
  source: "Paper, “Corpus and Task Datasets”",
} as const;

export interface TaskDataset {
  toolId: ToolId;
  name: string;
  size: string;
  structure: string;
  note?: string;
}

export const TASK_DATASETS: TaskDataset[] = [
  {
    toolId: "grammar",
    name: "Grammar checker",
    size: "36,006 rows",
    structure: "Correct or incorrect input paired with the corrected text",
  },
  {
    toolId: "headlines",
    name: "Headline generator",
    size: "43,737 training rows",
    structure: "Article, category and reference headline",
    note: "About 4,795 held out for validation",
  },
  {
    toolId: "summaries",
    name: "News summarizer",
    size: "35,547 articles",
    structure: "Article with short, medium and long summaries",
  },
  {
    toolId: "style",
    name: "Style rewriter",
    size: "7,555 rewrites",
    structure: "Article, target style and rewritten article",
    note: "Kept from 22,236 candidates (34.0%)",
  },
];

// ── The adapters (what was actually trained) ────────────────────────────────

export interface AdapterConfig {
  toolId: ToolId;
  name: string;
  version: string;
  rank: string;
  trainingData: string;
  epochs: string;
  trainableParams: string;
}

/**
 * Configurations of the adapters *evaluated in the paper*. These are research
 * versions and are not necessarily the ones currently deployed; the site
 * says so wherever it shows them. Source: Paper, Table “Selected LoRA
 * configurations”.
 */
export const ADAPTERS: AdapterConfig[] = [
  {
    toolId: "grammar",
    name: "Grammar",
    version: "v27",
    rank: "r=4, α=4",
    trainingData: "36,006 rows",
    epochs: "3",
    trainableParams: "10,485,760",
  },
  {
    toolId: "headlines",
    name: "Headline",
    version: "v19",
    rank: "r=64, α=128",
    trainingData: "43,737 rows",
    epochs: "8 (early stopping)",
    trainableParams: "167,772,160",
  },
  {
    toolId: "summaries",
    name: "Summary",
    version: "v06 / v07",
    rank: "r=32, α=64",
    trainingData: "28,455 articles",
    epochs: "3",
    trainableParams: "83,886,080",
  },
  {
    toolId: "style",
    name: "Style",
    version: "v13",
    rank: "r=24, α=48",
    trainingData: "7,555 rows",
    epochs: "3",
    trainableParams: "62,914,560",
  },
];

// ── Results ────────────────────────────────────────────────────────────────

export interface ResultRow {
  toolId: ToolId;
  /** What was measured, in plain words. */
  measure: string;
  value: string;
  /** How many things it was measured on. */
  testSet: string;
  /** The paper's own caveat, or context that changes how to read the number. */
  caveat: string;
}

export const RESULTS: ResultRow[] = [
  {
    toolId: "grammar",
    measure: "Output exactly matches the corrected reference",
    value: "56.99%",
    testSet: "286 hand-reviewed inputs (143 faulty, 143 clean controls)",
    caveat:
      "Strict exact match: a valid fix worded differently still counts as a miss.",
  },
  {
    toolId: "grammar",
    measure: "Faulty sentences corrected",
    value: "63 of 143",
    testSet: "The 143 faulty inputs",
    caveat:
      "Baselines on the same inputs: ByT5-small corrected 12 and mT5-small corrected none.",
  },
  {
    toolId: "grammar",
    measure: "Rule validator added to the grammar model",
    value: "66.88% → 66.88%",
    testSet: "154 saved development predictions",
    caveat:
      "The validator removed the one observed unsupported name change without losing any correct edits. It was tuned on this set, so the paper calls it an ablation, not an independent benchmark.",
  },
  {
    toolId: "headlines",
    measure: "Headline lands in the requested length band",
    value: "79.7%",
    testSet: "900 generated headlines",
    caveat: "By band: short 89.7%, medium 74.3%, long 75.0%.",
  },
  {
    toolId: "headlines",
    measure: "Headlines containing scraped-site artifacts",
    value: "1.1%",
    testSet: "900 generated headlines",
    caveat: "The previous version (v18) had 11.2%. The fix was cleaning the training headlines.",
  },
  {
    toolId: "headlines",
    measure: "Overlap with reference headlines (ROUGE-1)",
    value: "0.1824",
    testSet: "100 articles from an external publisher",
    caveat:
      "Headlines have many valid wordings, so overlap scores are low by nature. Up from 0.1567 for the earlier v17.",
  },
  {
    toolId: "summaries",
    measure: "Summary follows the requested length",
    value: "86.8% – 94.1%",
    testSet: "273 held-out articles, 819 summaries",
    caveat:
      "Range across the short, medium and long bands. More than 94% of outputs also end cleanly.",
  },
  {
    toolId: "summaries",
    measure: "Overlap with reference summaries (ROUGE-L)",
    value: "0.457 – 0.508",
    testSet: "273 held-out articles, 819 summaries",
    caveat:
      "The cleaned (v07) and raw (v06) training recipes were effectively tied, with a largest gap of 0.0018.",
  },
  {
    toolId: "style",
    measure: "Overlap with reference rewrites (ROUGE-L)",
    value: "0.784",
    testSet: "75 outputs (15 per style)",
    caveat:
      "A development diagnostic, not a style-accuracy score: it ranges from 0.730 (editorial) to 0.892 (formal), and the paper says a production-prompt test is still needed.",
  },
  {
    toolId: "style",
    measure: "Outputs that simply copy the input",
    value: "0%",
    testSet: "75 outputs (15 per style)",
    caveat:
      "Earlier data had serious copying and repetition; the final data pipeline removed it.",
  },
];

export const RESULTS_SOURCE = "Paper, results sections for each task";

// ── Engineering challenges ─────────────────────────────────────────────────

export interface Challenge {
  title: string;
  /** One line a non-specialist can follow. */
  plain: string;
  problem: string;
  found: string;
  fix: string;
}

export const CHALLENGES: Challenge[] = [
  {
    title: "A test score that was too good to be true",
    plain:
      "The headline model’s first evaluation looked twice as good as it really was.",
    problem:
      "To give small news categories enough examples, articles were duplicated before the data was split into training and test sets.",
    found:
      "Copies of the same article ended up on both sides, so the model was partly graded on text it had already seen. ROUGE-1 read 0.2933 with 485 exact matches; on a clean split it was 0.1382 with none.",
    fix: "Repaired the split so no article appears on both sides. The paper reports both sets of numbers so the difference is visible.",
  },
  {
    title: "A summary test that was 81% contaminated",
    plain:
      "Most of the “unseen” test articles for the summarizer had actually been seen in training.",
    problem:
      "Each article was expanded into short, medium and long examples and then shuffled. An article only stays unseen if all three versions land in the test set, which happens about 0.34% of the time.",
    found:
      "An audit found about 81% of the nominal held-out articles had already appeared in training under another length.",
    fix: "Rebuilt the split per article (80/10/10), froze a 300-article evaluation set and retrained. The two training recipes then turned out to perform almost identically.",
  },
  {
    title: "Most generated training data was unusable",
    plain:
      "For the style rewriter, only about a third of the machine-written examples were good enough to keep.",
    problem:
      "Generated rewrites often copied the source, repeated phrases, changed facts or broke the script.",
    found:
      "Only 7,555 of 22,236 candidates (34.0%) passed the checks for copying, repetition, factual consistency, structure, script and length.",
    fix: "Kept only the passing examples. The v13 adapter trained on them shows a 0% direct-copy rate in the paper’s diagnostic.",
  },
  {
    title: "Two invisible characters that look the same",
    plain:
      "Cleaning Sinhala text the usual way can quietly break it.",
    problem:
      "Scraped Sinhala contains two visually similar invisible characters: a soft hyphen and a zero-width joiner.",
    found:
      "The soft hyphen (in 85.8% of rows in one working file) disrupts tokenization and should go. The zero-width joiner is part of valid letter combinations and must stay.",
    fix: "Character-aware cleaning instead of a blanket “strip invisible characters” rule.",
  },
  {
    title: "A safety net that cost accuracy",
    plain:
      "A rule-based checker meant to protect grammar edits was blocking good corrections too.",
    problem:
      "Rules were added to stop the grammar model from changing names or numbers.",
    found:
      "The first, blanket-veto version dropped exact match from 66.88% to 57.14% by blocking useful edits.",
    fix: "A selective policy restored 66.88% and removed the one observed unsupported name change. The paper flags this as an ablation on the development set.",
  },
];

// ── Engine, security, limits ───────────────────────────────────────────────

export interface Feature {
  title: string;
  plain: string;
  detail: string;
}

export const ENGINE: Feature[] = [
  {
    title: "One shared base, four specialists",
    plain: "Each tool has its own small add-on model.",
    detail:
      "The system adapts the SinLlama base model with a separate LoRA adapter for each task. The base is loaded once in 4-bit form and the adapter for the requested task is swapped in, so one GPU can serve all four tools.",
  },
  {
    title: "It keeps working when the GPU is down",
    plain: "If the main model is offline, a backup answers.",
    detail:
      "Every request goes through a model gateway that tries the research model first, then a hosted backup model, then a deterministic rule-based fallback. Each response reports which one answered so the app can label it.",
  },
  {
    title: "Prompts match how the models were trained",
    plain: "Each task is asked the way it was taught.",
    detail:
      "The backend reproduces the exact instruction templates the adapters were trained on. Length is controlled in the prompt, and headlines outside the requested word band are regenerated and, if needed, trimmed.",
  },
  {
    title: "Headlines are checked against the article",
    plain: "Invented numbers get flagged.",
    detail:
      "A rule-based check compares the numbers and words in a generated headline with the source article and flags mismatches for a human to review. It runs without retraining the model.",
  },
  {
    title: "Grammar edits pass a rule validator",
    plain: "Risky edits are caught before you see them.",
    detail:
      "A validator reviews each grammar correction and can flag or roll back edits that change names or numbers, while keeping the corrections that are right.",
  },
];

export const SECURITY: { title: string; detail: string }[] = [
  {
    title: "Hashed passwords",
    detail: "Passwords are hashed with bcrypt. Plain-text passwords are never stored.",
  },
  {
    title: "Signed sessions",
    detail:
      "Sign-in issues signed access and refresh tokens. A refresh token cannot be replayed as an access token.",
  },
  {
    title: "Per-user history",
    detail:
      "Saved history is protected by Postgres row-level security, so each person can read only their own records.",
  },
  {
    title: "Admin-only areas",
    detail: "The admin dashboard and its API require an admin role.",
  },
  {
    title: "Rate-limited anonymous use",
    detail:
      "Signed-out requests are limited per hour (20 by default) using a salted hash of the IP address, and their results are not saved.",
  },
  {
    title: "Audit log",
    detail: "Changes made through the admin settings are recorded in an audit log.",
  },
  {
    title: "Feature switches",
    detail: "Admins can turn each tool on or off without redeploying.",
  },
  {
    title: "Tested offline",
    detail:
      "The backend test suite runs against a fake database and a mock model provider, so it needs no network or GPU.",
  },
];

export const LIMITS: string[] = [
  "Results are from the adapter versions evaluated in the paper. Those are not necessarily the versions currently deployed.",
  "The grammar benchmark is small (286 inputs) and scored by strict exact match, which under-counts valid alternative fixes.",
  "The style diagnostic (75 outputs) does not prove every output follows the requested style or keeps every fact. A production-prompt test is still needed.",
  "The user evaluation is 13 self-selected respondents. It shows early impressions, not a controlled study.",
  "AI output can be wrong. Editors should review every result before publishing.",
];
