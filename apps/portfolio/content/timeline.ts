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
      "Crawled 1,031,456 Sinhala news articles (the latest dated 4 March 2026) and filtered them down to the corpus the models learn from.",
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
