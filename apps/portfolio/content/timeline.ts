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
 * Homepage storyline, October 2025 to December 2026, in date order. Initiation,
 * implementation stage, final presentation and publication are from the
 * project owner; the proposal, PP1, PP2 and paper entries use the dates the
 * team recorded for those submissions; the Top 10 finalist entry is
 * documented in `components/AiExpo.tsx`. PP2's exact day is not recorded, so
 * it is ordered by month only.
 */
export interface StoryItem {
  id: string;
  when: string;
  title: string;
  content: string;
}

export const STORYLINE_PERIOD = "October 2025 — December 2026";

export const STORYLINE: StoryItem[] = [
  {
    id: "2025-10-initiation",
    when: "October 2025",
    title: "Initiation",
    content:
      "The research project is initiated and its initial scope for R26-SE-037 set out.",
  },
  {
    id: "2026-03-proposal",
    when: "March 2026",
    title: "Proposal",
    content:
      "Four individual proposal reports (12–13 March) and the proposal presentation (16 March).",
  },
  {
    id: "2026-04-implementation",
    when: "April 2026",
    title: "Implementation stage",
    content:
      "Building the four task components: grammar checker, headline generator, news summarizer and style rewriter.",
  },
  {
    id: "2026-05-pp1",
    when: "May 2026",
    title: "Progress Presentation 1 (PP1)",
    content:
      "Component status, architecture and the evaluation plan (11 May).",
  },
  {
    id: "2026-09-pp2",
    when: "September 2026",
    title: "Progress Presentation 2 (PP2)",
    content:
      "Updated datasets, four task adapters and product progress.",
  },
  {
    id: "2026-09-paper",
    when: "3 September 2026",
    title: "Research paper completed",
    content: "The SinhalaJournal-LLM research paper completed.",
  },
  {
    id: "2026-09-top10",
    when: "25 September 2026",
    title: "Top 10 finalist",
    content:
      "Reached the top 10 in the University AI Innovation category at the CodeBlast Hackathon Challenge 2026 (National AI Expo, Sri Lanka AI Week), SLT Auditorium, and received certificates.",
  },
  {
    id: "2026-10-final",
    when: "October 2026",
    title: "Final presentation",
    content: "Final project presentation.",
  },
  {
    id: "2026-12-publication",
    when: "December 2026",
    title: "Research publication",
    content: "Planned publication of the research.",
  },
];
