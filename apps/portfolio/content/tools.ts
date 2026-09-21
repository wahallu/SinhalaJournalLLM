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
      "Paste a paragraph and get a corrected version back. It fixes mistakes and leaves sentences that are already right alone.",
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
      "Give it an article and pick a length. You get up to ten distinct headline options to choose from.",
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
      "Choose a target style and the article is rewritten to match it, keeping the facts the same.",
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
      "Condense a long article into a short, medium or long summary that keeps the main points.",
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
      "Work in the browser with all four tools, sign in to keep your history, and convert between Unicode and legacy Sinhala fonts.",
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
      "Select text on any web page, then use the popup or the right-click menu to check, rewrite or summarize it.",
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
      "A sidebar next to your Google Doc lets a newsroom check grammar, get headlines and summarize without leaving the page.",
    points: [
      "Sidebar docked beside your document",
      "Designed for shared newsroom drafts",
      "Privacy policy and terms published for Google Workspace",
    ],
    cta: { label: "About the add-on", href: "/docs-addon" },
  },
];
