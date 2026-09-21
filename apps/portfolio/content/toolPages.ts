import type { ToolId } from "./tools";

/**
 * Copy for the four /research/<tool> deep-dive pages. Numbers are not typed
 * here: figures come from content/research.ts (RESULTS, ADAPTERS,
 * TASK_DATASETS) and content/evaluation.ts, so they stay sourced.
 *
 * Statements about how a tool works were checked against
 * `apps/backend-api/app/core/prompts.py`, `apps/backend-api/app/services/`
 * and the paper.
 */
export interface ToolPage {
  toolId: ToolId;
  slug: string;
  title: string;
  description: string;
  summary: string;
  howItWorks: { title: string; body: string }[];
  /** Optional list, e.g. what the training data covers or the five styles. */
  list?: { heading: string; intro?: string; items: { name: string; body?: string }[] };
  /** Index into CHALLENGES for the story most relevant to this tool. */
  challenge: number;
}

export const TOOL_PAGES: ToolPage[] = [
  {
    toolId: "grammar",
    slug: "grammar-checker",
    title: "Grammar checker",
    description:
      "How the SinAi Sinhala grammar checker was built and evaluated: data, model, safeguards and results.",
    summary:
      "Finds and fixes grammar, spelling and punctuation errors in Sinhala news text, without rewriting sentences that were already correct.",
    howItWorks: [
      {
        title: "Fix only what is wrong",
        body: "The model is instructed to fix errors only and to return correct text unchanged. Training included already-correct sentences so it learns that not every input needs an edit.",
      },
      {
        title: "A small, efficient adapter",
        body: "The grammar adapter uses a low rank (r=4). The paper reports it uses about one eighth of the trainable parameters of the rank-32 configurations while staying statistically comparable on its Stage 6 test.",
      },
      {
        title: "Corrections you can review",
        body: "The API returns the corrected text together with word-level corrections, so the app can show each change instead of only the final text.",
      },
      {
        title: "A rule validator as a safety net",
        body: "A rule-based validator reviews each edit and can flag or roll back risky changes to names and numbers, while keeping the corrections that are right.",
      },
    ],
    list: {
      heading: "What the training data covers",
      intro: "From the team’s dataset notes:",
      items: [
        { name: "Spelling and look-alike letters, for example ණ/න and ළ/ල" },
        { name: "Word order (subject–object–verb)" },
        { name: "Plural verb agreement in literary Sinhala" },
        { name: "Already-correct sentences, kept as a control set" },
      ],
    },
    challenge: 4,
  },
  {
    toolId: "headlines",
    slug: "headline-generator",
    title: "Headline generator",
    description:
      "How the SinAi Sinhala headline generator was built and evaluated: length control, fact checking and results.",
    summary:
      "Generates headline options for a Sinhala news article in the length band an editor asks for.",
    howItWorks: [
      {
        title: "Three length bands",
        body: "Short is 3–5 words, medium is 6–7 and long is 8–10. The bands do not overlap, so a word count maps to exactly one band.",
      },
      {
        title: "Length is enforced, not just requested",
        body: "The requested band goes into the prompt. As a safety net, the service regenerates out-of-band headlines with a corrective hint and trims anything over the ceiling.",
      },
      {
        title: "Clean training headlines",
        body: "Scraped headlines carried tags like (වීඩියෝ) or [Photos]. Stripping them from the training set and recomputing the bands cut the artifact rate from 11.2% to 1.1% without hurting length accuracy.",
      },
      {
        title: "Fact guard",
        body: "Numbers in a generated headline are checked against the article, including unit words such as මිලියන and කෝටි. Words are checked for whether they appear in the source. Mismatches are flagged as prompts for human review, not as verdicts.",
      },
      {
        title: "Variety across options",
        body: "Distinct candidates come from prompt variation hints, so the options take different angles.",
      },
    ],
    challenge: 0,
  },
  {
    toolId: "style",
    slug: "style-rewriter",
    title: "Style rewriter",
    description:
      "How the SinAi Sinhala style rewriter was built and evaluated: five newspaper styles, data quality and results.",
    summary:
      "Rewrites a Sinhala news article in one of five newspaper styles while keeping the facts the same.",
    howItWorks: [
      {
        title: "Trained on filtered rewrites",
        body: "The training data is machine-written rewrites that passed strict filters for copying, repetition, factual consistency, structure, script and length. About a third survived.",
      },
      {
        title: "Meaning first",
        body: "The prompt tells the model to keep the meaning unchanged and to use natural Sinhala.",
      },
      {
        title: "Shared base, swapped adapter",
        body: "The style adapter sits beside the grammar, headline and summary adapters on the same base model, and the inference server swaps the right one in for each request.",
      },
      {
        title: "An honest evaluation",
        body: "The paper’s style score is a development diagnostic, not an accuracy measure. It says a test with the production prompt is still needed, so treat the style results as preliminary.",
      },
    ],
    list: {
      heading: "The five styles",
      items: [
        {
          name: "Formal news",
          body: "Standard broadcast and broadsheet tone: objective and structured.",
        },
        {
          name: "Sports reporting",
          body: "Dynamic, action-oriented wording that matches live sports coverage.",
        },
        {
          name: "Youth and culture",
          body: "Modern, conversational wording for younger readers and digital-first formats.",
        },
        {
          name: "Editorial opinion",
          body: "Authoritative and reflective, with a clear point of view.",
        },
        {
          name: "Feature story",
          body: "Narrative and descriptive, built for long-form reading.",
        },
      ],
    },
    challenge: 2,
  },
  {
    toolId: "summaries",
    slug: "news-summarizer",
    title: "News summarizer",
    description:
      "How the SinAi Sinhala news summarizer was built and evaluated: length control, prompt design and results.",
    summary:
      "Condenses a long Sinhala news article into a short, medium or long summary.",
    howItWorks: [
      {
        title: "Abstractive, not copy-paste",
        body: "It writes new sentences instead of pulling lines from the article.",
      },
      {
        title: "Stays inside the article",
        body: "The prompt tells the model to use only information from the article and not to add extra ideas, analysis or new facts.",
      },
      {
        title: "Length as a target",
        body: "For short, medium and long summaries the backend sends a prompt with a scaled word target. The paper measures how often the output lands in the requested band.",
      },
      {
        title: "A different prompt format",
        body: "The summarizer is trained on the Llama 3 chat format, while the grammar, headline and style tools use Alpaca-style instruction prompts.",
      },
    ],
    challenge: 1,
  },
];

export const TOOL_PAGE_BY_SLUG = Object.fromEntries(
  TOOL_PAGES.map((p) => [p.slug, p]),
) as Record<string, ToolPage>;
