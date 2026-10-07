/**
 * The four writing tools, described in plain language.
 * Facts here come from the README, `apps/backend-api/app/core/prompts.py`
 * and the research paper. Do not add capabilities that are not in the code.
 */
export type ToolId = "grammar" | "headlines" | "style" | "summaries";

export interface Tool {
  id: ToolId;
  name: string;
  /** One plain-language line: what you get. */
  tagline: string;
  description: string;
  points: string[];
  /** Deep-dive page for people who want the technical detail. */
  href: string;
}

export const TOOLS: Tool[] = [
  {
    id: "grammar",
    name: "Grammar checker",
    tagline: "Fix grammar and spelling without losing your voice.",
    description:
      "Paste draft text to fix grammar, spelling, and punctuation while preserving correct sentences as-is.",
    points: [
      "Corrects grammar, spelling and punctuation",
      "Keeps your meaning and wording where it is already correct",
      "Lists each correction so you can review it",
    ],
    href: "/research/grammar-checker",
  },
  {
    id: "headlines",
    name: "Headline generator",
    tagline: "Get headline options in the length you need.",
    description:
      "Provide an article and choose a length to generate up to ten distinct, fact-checked headline options.",
    points: [
      "Short (3–5 words), medium (6–7) or long (8–10)",
      "Numbers in a headline are checked against the article",
      "Anything that does not match the story is flagged for a human to review",
    ],
    href: "/research/headline-generator",
  },
  {
    id: "style",
    name: "Style rewriter",
    tagline: "Rewrite the same story for a different newspaper.",
    description:
      "Rewrite articles across five distinct newspaper tones while preserving core facts and meaning.",
    points: [
      "Five styles: formal news, sports, youth, editorial and feature",
      "Built for newspaper registers, not generic paraphrasing",
      "Review the result before you publish it",
    ],
    href: "/research/style-rewriter",
  },
  {
    id: "summaries",
    name: "News summarizer",
    tagline: "Long story in, clear summary out.",
    description:
      "Condense lengthy stories into concise, coherent summaries tailored to your preferred length.",
    points: [
      "Three lengths: short, medium and long",
      "Abstractive: it writes new sentences instead of copying lines",
      "Use it to brief an editor or draft a standfirst",
    ],
    href: "/research/news-summarizer",
  },
];

export const TOOL_BY_ID = Object.fromEntries(
  TOOLS.map((t) => [t.id, t]),
) as Record<ToolId, Tool>;

export interface Surface {
  id: "web" | "chrome" | "docs";
  name: string;
  tagline: string;
  description: string;
  points: string[];
  cta: { label: string; href: string };
}

export const SURFACES: Surface[] = [
  {
    id: "web",
    name: "Web app",
    tagline: "The full writing studio.",
    description:
      "A full browser studio with all four tools, cloud history, and real-time Unicode to legacy Sinhala font conversion.",
    points: [
      "All four tools in one workspace",
      "Saved history for signed-in users",
      "Unicode ↔ legacy-font converter in the editor",
      "Try it without an account (limited use)",
    ],
    cta: { label: "Open the web app", href: "https://chat.sin-ai.app" },
  },
  {
    id: "chrome",
    name: "Chrome extension",
    tagline: "Help wherever you type.",
    description:
      "Highlight text anywhere on the web to quickly check grammar, generate headlines, or summarize via context menu.",
    points: [
      "Popup and right-click menu",
      "Works on any page where you can select text",
      "Uses the same models as the web app",
    ],
    cta: {
      label: "View the extension",
      href: "https://github.com/wahallu/SinhalaJournalLLM/tree/main/apps/chrome-extension",
    },
  },
  {
    id: "docs",
    name: "Google Docs add-on",
    tagline: "Inside your document.",
    description:
      "A docked sidebar inside Google Docs allowing writers and editors to run all four tools directly within their active document.",
    points: [
      "Sidebar docked beside your document",
      "Designed for shared newsroom drafts",
      "Privacy policy and terms published for Google Workspace",
    ],
    cta: { label: "About the add-on", href: "/docs-addon" },
  },
];
