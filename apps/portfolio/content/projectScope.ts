import type { ToolId } from "./tools";

/**
 * Copy for the /project-scope page. Sources:
 *   Paper    = Research/paper.tex (Introduction, Related Work, Corpus,
 *              Model Adaptation, Evaluation, System Integration)
 *   Proposal = public/documents/proposal-presentation.pdf (16 March 2026)
 * Keep wording close to those documents; do not add claims they do not make.
 */

export const SCOPE_SECTIONS = [
  { id: "literature-survey", label: "Literature survey" },
  { id: "research-gap", label: "Research gap" },
  { id: "problem-solution", label: "Research problem & solution" },
  { id: "objectives", label: "Research objectives" },
  { id: "methodology", label: "Methodology" },
] as const;

// ── Literature survey (Paper, Related Work) ─────────────────────────────────

export interface Study {
  work: string;
  cite: string;
  found: string;
  limit: string;
}

export const LITERATURE: Study[] = [
  {
    work: "Survey of Sinhala NLP tools",
    cite: "de Silva, 2019",
    found: "Mapped the publicly available Sinhala NLP tools and research.",
    limit: "Sinhala has far fewer datasets, benchmarks and task systems than high-resource languages.",
  },
  {
    work: "SinBERT and Sinhala encoder models",
    cite: "Dhananjaya et al., 2022; Ranasinghe et al., 2025",
    found: "Strong baselines for Sinhala text representation and classification.",
    limit: "Encoders, not generative decoders: they cannot write or rewrite text.",
  },
  {
    work: "SinLlama",
    cite: "Aravinda et al., MERCon 2025",
    found: "Extended Llama 3 8B with Sinhala vocabulary and continual pretraining, then used LoRA for classification.",
    limit: "Not adapted for constrained generation tasks such as newsroom writing.",
  },
  {
    work: "NSina news corpus",
    cite: "Hettiarachchi et al., 2024",
    found: "Over 500,000 Sinhala news articles with media, category and headline-generation benchmarks.",
    limit: "Covers headlines only, not grammar, summaries or style.",
  },
  {
    work: "TF-IDF and TextRank summarization; mT5 and XL-Sum",
    cite: "Akmal Jahan & Wijesekara, 2023; Xue et al., 2021; Hasan et al., 2021",
    found: "Extractive Sinhala summaries, and multilingual models for abstractive summaries.",
    limit: "Extractive methods copy sentences; multilingual models are not tuned for Sinhala journalism.",
  },
  {
    work: "Rule-based and hybrid spelling and grammar checkers",
    cite: "Goonawardena et al., 2022",
    found: "Detected and corrected Sinhala spelling and grammar errors with rules.",
    limit: "Rule-based; does not use a Sinhala large language model.",
  },
  {
    work: "LoRA and QLoRA",
    cite: "Hu et al., 2022; Dettmers et al., 2023",
    found: "Train small low-rank adapters on a frozen, 4-bit base model.",
    limit: "Makes four task adapters practical without four full 8B models.",
  },
  {
    work: "Text style transfer evaluation",
    cite: "Ostheimer et al., 2024",
    found: "Style transfer must balance style change, content preservation and fluency.",
    limit: "Overlap metrics alone are inadequate, so each task needs its own measures.",
  },
];

// ── Research gap (Paper, Introduction; Proposal, per component) ─────────────

export const GAP_SUMMARY =
  "Sinhala studies address single tasks, such as extractive summarization or rule-based grammar correction. Adapting one Sinhala decoder across the connected newsroom tasks remains less explored.";

export const COMPONENT_GAPS: Record<ToolId, string> = {
  grammar:
    "Current Sinhala grammar correction tools rely mainly on rule-based methods and do not use Sinhala large language models.",
  headlines:
    "No AI system generates style-controlled Sinhala news headlines, so newsrooms rely on manual headline writing.",
  summaries:
    "Existing Sinhala summarizers are mainly extractive and copy sentences, and none is designed for Sinhala journalism writing style.",
  style:
    "Existing Sinhala NLP systems write in a single neutral style, with no validated way to rewrite the same article into multiple journalistic styles.",
};

// ── Problem and solution (Proposal; Paper, Introduction and Integration) ────

export const PROBLEM = [
  "There are no AI-powered editorial tools for Sinhala journalism.",
  "Grammar correction, rewriting, headline writing and summarization are done by hand.",
  "The workflow is time-consuming and inconsistent, under deadline pressure.",
  "Names, numbers, dates, quotations and meaning must stay correct through every edit.",
];

export const SOLUTION = [
  "A unified AI newsroom assistant, SinhalaJournal-LLM, delivered as SinAi.",
  "SinLlama as one shared base model, loaded in 4-bit form so repeated adaptation stays practical on limited hardware.",
  "One LoRA adapter per task: grammar, headlines, summaries and style.",
  "Safety steps around the model: grammar can revert unsafe edits, and headline output is cleaned.",
  "Available in a web app, a Chrome extension and a Google Docs add-on, through one FastAPI backend.",
];

// ── Objectives (Proposal) ───────────────────────────────────────────────────

export const MAIN_OBJECTIVE =
  "To build a unified Sinhala newsroom assistant by adapting one Sinhala language model to four connected editorial tasks, and to evaluate each task with measures suited to it.";

export const OBJECTIVES: {
  tool: ToolId;
  owner: string;
  objective: string;
  sub: string[];
}[] = [
  {
    tool: "grammar",
    owner: "Fonseka G N V S",
    objective:
      "Develop a hybrid Sinhala grammar correction system using a fine-tuned Sinhala LLM integrated with rule-based validation.",
    sub: [
      "Prepare Sinhala sentences with grammar errors and their corrected versions",
      "Fine-tune SinLlama for grammar correction",
      "Develop rule-based grammatical validation",
      "Integrate both into a hybrid correction framework",
      "Evaluate with standard NLP metrics",
    ],
  },
  {
    tool: "headlines",
    owner: "Jayasinghe I A S A",
    objective:
      "Develop a Sinhala LLM-based system that generates style-adaptive news headlines.",
    sub: [
      "Build a Sinhala news dataset for headline generation",
      "Fine-tune SinLlama for headline generation",
      "Implement controlled headline generation",
      "Extract key entities and keywords from headlines",
    ],
  },
  {
    tool: "summaries",
    owner: "Navod W D C",
    objective:
      "Design a meaning-preserving abstractive summarizer for Sinhala news.",
    sub: [
      "Build a Sinhala news article dataset",
      "Design a meaning-preserving summarization model",
      "Implement factual consistency checking",
      "Evaluate summaries against human references",
    ],
  },
  {
    tool: "style",
    owner: "Hettiarachchi H A S L",
    objective:
      "Develop a style-controlled rewriter that turns a news article into multiple journalistic styles without changing its meaning.",
    sub: [
      "Prepare a Sinhala news dataset for style transformation",
      "Identify the different news writing styles",
      "Train SinLlama with LoRA",
      "Use prompts to control the writing style",
    ],
  },
];

// ── Methodology (Proposal: approach; Paper: each step) ──────────────────────

export const APPROACH =
  "Design Science Research: build a working AI system for a real newsroom problem, then evaluate it experimentally with real news data.";

export const METHOD_STEPS: { title: string; body: string }[] = [
  {
    title: "Collect the news",
    body: "Project crawlers collected 1,031,456 articles from Sri Lankan Sinhala news sites, dated 13 March 2008 to 4 March 2026. No NSina data were used.",
  },
  {
    title: "Clean and filter",
    body: "Exact duplicates removed; articles kept only with a 300–10,000 character body, a 10–200 character title and at least 30% Sinhala characters. 665,887 remained.",
  },
  {
    title: "Build task datasets",
    body: "Four datasets derived from the cleaned corpus, one per task. Leakage audits led to rebuilding splits so test articles stay out of training.",
  },
  {
    title: "Adapt the model",
    body: "SinLlama loaded in 4-bit NF4 with BF16 compute, and one LoRA adapter trained per task on top of the frozen base.",
  },
  {
    title: "Evaluate per task",
    body: "Grammar on a frozen, manually reviewed benchmark against ByT5-small and mT5-small; headlines with ROUGE on articles from an external publisher; summaries on 273 held-out articles; style with quality filters and a diagnostic review.",
  },
  {
    title: "Integrate and test",
    body: "A FastAPI backend serves the adapters to the web app, Chrome extension and Google Docs add-on, followed by a small pilot with newsroom users.",
  },
];
