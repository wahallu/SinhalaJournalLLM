"use client";

import Timeline, { type JourneyItem } from "@/components/ui/timeline";

// Portfolio milestones mapped to top and bottom alternating journey nodes
const portfolioTopMilestones: JourneyItem[] = [
  {
    id: "2026-march-corpus",
    year: "2026",
    month: "March",
    when: "Up to March 2026",
    title: "Building the News Corpus",
    content:
      "Collected 884,193 Sinhala news articles (latest 4 March 2026) and filtered them down to the 665,887-article benchmark corpus used across task datasets.",
    source: "Research Paper",
  },
  {
    id: "2026-july-gateway",
    year: "2026",
    month: "July",
    when: "18 July 2026",
    title: "Resilient Model Gateway",
    content:
      "Engineered three-tier fallback mechanism so tools stay responsive during GPU cluster downtime, with unified history synchronisation.",
    source: "git log",
  },
  {
    id: "2026-aug-eval",
    year: "2026",
    month: "August",
    when: "27–31 August 2026",
    title: "Newsroom User Evaluation",
    content:
      "Thirteen Sinhala journalists, editors, and university teachers conducted formal usability evaluations across all four editorial tools.",
    source: "Evaluation Form",
  },
];

const portfolioBottomMilestones: JourneyItem[] = [
  {
    id: "2026-july-clients",
    year: "2026",
    month: "July",
    when: "1–2 July 2026",
    title: "Architecture & First Clients",
    content:
      "Established loosely coupled backend services and Supabase database, followed by Chrome extension and Google Docs add-on clients.",
    source: "git log",
  },
  {
    id: "2026-aug-admin",
    year: "2026",
    month: "August",
    when: "1–3 August 2026",
    title: "Accounts, History & Admin",
    content:
      "Implemented sign-in, per-user history under PostgreSQL row-level security, administrative dashboard with feature toggles, and self-hosted auth.",
    source: "git log",
  },
  {
    id: "2026-sept-polish",
    year: "2026",
    month: "September",
    when: "16–17 September 2026",
    title: "Plans & Interface Polish",
    content:
      "Rolled out plan tiers with token usage tracking, Sinhala/English bilingual UI toggle, and newsroom aesthetic refinements.",
    source: "git log",
  },
];

export default function PortfolioMilestones() {
  return (
    <div className="relative w-full bg-[#141414] text-white">
      {/* Intro Header Section leading into the pinned timeline */}
      <section
        id="milestones"
        className="scroll-mt-24 pt-24 pb-12 sm:pt-32 sm:pb-16 border-t border-white/10"
      >
        <div className="mx-auto max-w-4xl px-5 text-center sm:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-crimson font-semibold mb-3">
            Milestones &amp; Evolution
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl text-balance">
            How the research moved from corpus building to a working product.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base sm:text-lg leading-relaxed text-[#A39E93]">
            Track our journey from raw Sinhala news archives to four production-ready AI writing tools.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-xs font-mono text-[#A39E93]/70">
            <span className="inline-block animate-bounce">&darr;</span>
            <span>Scroll down to explore the interactive timeline</span>
            <span className="inline-block animate-bounce">&darr;</span>
          </div>
        </div>
      </section>

      {/* Pinned Horizontal GSAP Timeline */}
      <Timeline
        title="Project Storyline"
        periodLabel="March 2026 — Sept 2026"
        topItems={portfolioTopMilestones}
        bottomItems={portfolioBottomMilestones}
        backgroundColor="#141414"
        textColor="#FAF9F5"
        mutedTextColor="#A39E93"
        activeColor="#cd191a"
        imageUrl="https://images.unsplash.com/photo-1585829365295-ab7cd400c167?q=80&w=1200&auto=format&fit=crop"
        imageAlt="Sinhala news archives and editorial research lab"
        duration={1.2}
      />
    </div>
  );
}
