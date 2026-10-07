/**
 * Build timeline, reconstructed from `git log` (which starts on 1 July 2026)
 * and the research paper. Work before July 2026 predates this repository, so
 * that phase is left undated on purpose; add dates once the team confirms
 * them.
 */
export interface Milestone {
  when: string;
  title: string;
  detail: string;
  source: string;
}

export const TIMELINE: Milestone[] = [
  {
    when: "Up to March 2026",
    title: "Building the news corpus",
    detail:
      "Collected 1,031,456 Sinhala news articles (the latest dated 4 March 2026) and filtered them down to the 665,887-article corpus used for the task datasets.",
    source: "Paper",
  },
  {
    when: "1–2 July 2026",
    title: "Architecture and first clients",
    detail:
      "Loosely coupled backend, Supabase database, then the Chrome extension and the Google Docs add-on.",
    source: "git log",
  },
  {
    when: "18 July 2026",
    title: "Resilient model gateway",
    detail:
      "Three-tier fallback so the product keeps working while the GPU server is down, plus a unified history feed.",
    source: "git log",
  },
  {
    when: "1–3 August 2026",
    title: "Accounts, history and admin",
    detail:
      "Sign-in, per-user history under row-level security, the admin dashboard with feature switches and settings, then self-hosted authentication.",
    source: "git log",
  },
  {
    when: "27–31 August 2026",
    title: "User evaluation",
    detail:
      "Thirteen editors, journalism students and teachers tried the tools and rated them.",
    source: "Evaluation form",
  },
  {
    when: "16–17 September 2026",
    title: "Plans and interface polish",
    detail:
      "Plan tiers with usage tracking and a Sinhala/English interface toggle.",
    source: "git log",
  },
];

/**
 * Homepage storyline, December 2025 to September 2026, in date order. The
 * December entry is from the team; the March, May and September documents
 * carry their dates in `content/documents.ts`; the rest match TIMELINE above.
 */
export interface StoryItem {
  id: string;
  when: string;
  title: string;
  content: string;
}

export const STORYLINE_PERIOD = "December 2025 — Sept 2026";

export const STORYLINE: StoryItem[] = [
  {
    id: "2025-12-topic",
    when: "December 2025",
    title: "Topic approval",
    content:
      "Research topic assessed and approved, and the initial project scope for R26-SE-037 set out.",
  },
  {
    id: "2026-03-corpus",
    when: "Up to March 2026",
    title: "News corpus",
    content:
      "Collected 1,031,456 Sinhala news articles and filtered them down to the 665,887-article corpus used for the task datasets.",
  },
  {
    id: "2026-03-proposals",
    when: "12–16 March 2026",
    title: "Proposals",
    content:
      "Four individual proposal reports submitted, one per tool, and the proposal presented.",
  },
  {
    id: "2026-05-progress",
    when: "11 May 2026",
    title: "First progress review",
    content:
      "Progress presentation 1: component status, architecture and the evaluation plan.",
  },
  {
    id: "2026-07-clients",
    when: "1–2 July 2026",
    title: "Architecture and clients",
    content:
      "Loosely coupled backend and database, then the Chrome extension and the Google Docs add-on.",
  },
  {
    id: "2026-07-gateway",
    when: "18 July 2026",
    title: "Model gateway",
    content:
      "Three-tier fallback keeps the tools working while the GPU server is down, plus a unified history feed.",
  },
  {
    id: "2026-08-accounts",
    when: "1–3 August 2026",
    title: "Accounts and admin",
    content:
      "Sign-in, per-user history under row-level security, the admin dashboard and self-hosted authentication.",
  },
  {
    id: "2026-08-evaluation",
    when: "27–31 August 2026",
    title: "User evaluation",
    content:
      "Thirteen editors, journalism students and teachers tried the four tools and rated them.",
  },
  {
    id: "2026-09-paper",
    when: "3 September 2026",
    title: "Research paper",
    content: "The SinhalaJournal-LLM research paper completed.",
  },
  {
    id: "2026-09-polish",
    when: "16–17 September 2026",
    title: "Interface polish",
    content:
      "Plan tiers with usage tracking and a Sinhala/English interface toggle.",
  },
];
