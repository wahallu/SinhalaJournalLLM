"use client";

import React, { useState } from "react";
import {
  Laptop,
  Globe,
  FileSpreadsheet,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";

interface EcosystemItem {
  id: string;
  title: string;
  category: string;
  badge: string;
  icon: React.ReactNode;
  headline: string;
  description: string;
  highlights: string[];
  ctaLabel: string;
  ctaUrl: string;
  techStack: string[];
}

const ECOSYSTEM_DATA: EcosystemItem[] = [
  {
    id: "webapp",
    title: "SinAi Web App",
    category: "Writing Studio & Workspace",
    badge: "Flagship Workspace",
    icon: <Laptop className="w-4 h-4 sm:w-5 sm:h-5 text-[#cd191a]" />,
    headline: "The complete two-pane editorial studio and live interactive workspace.",
    description:
      "A distraction-free web workspace engineered for journalists and writers. Features split-screen comparison, live character-capped textareas, syntactic diff highlighting, tone selection, and persistent cross-device history.",
    highlights: [
      "Two-pane editor with instant syntactic diff highlighting",
      "Saved cross-device history with Postgres Row-Level Security",
      "Interactive 5-tone register rewriting and abstractive summaries",
      "Salted IP rate limits and secure authentication",
    ],
    ctaLabel: "Try SinAi Workspace",
    ctaUrl: "https://chat.sin-ai.app",
    techStack: ["React 19", "Vite", "Tailwind CSS", "Supabase Auth", "Radix UI"],
  },
  {
    id: "chrome",
    title: "Chrome Extension",
    category: "Browser Assistant",
    badge: "Manifest V3",
    icon: <Globe className="w-4 h-4 sm:w-5 sm:h-5 text-[#cd191a]" />,
    headline: "Real-time Sinhala AI directly in your browser and CMS workflows.",
    description:
      "Bring SinAi's linguistic intelligence into WordPress, Ghost, Google News, or Webmail. Highlight any text on any webpage to instantly check grammar, draft headlines, or summarize long-form articles without leaving your tab.",
    highlights: [
      "Context-menu instant AI grammar checks on right-click",
      "Floating action bubble for quick paraphrasing",
      "Zero-latency popup interface with keyboard shortcuts",
      "Privacy-first background service worker architecture",
    ],
    ctaLabel: "Explore Extension Code",
    ctaUrl: "https://github.com/wahallu/SinhalaJournalLLM/tree/main/apps/chrome-extension",
    techStack: ["Manifest V3", "Service Workers", "Context Menus", "Chrome Storage"],
  },
  {
    id: "docs",
    title: "Google Docs Add-on",
    category: "Newsroom Collaboration",
    badge: "Google Apps Script",
    icon: <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-[#cd191a]" />,
    headline: "Integrated sidebar assistant built for newsroom drafting in Google Docs.",
    description:
      "Built with Google Apps Script. Journalists can draft articles in Google Docs while SinAi's sidebar continuously checks grammatical harmony, suggests front-page titles, and condenses paragraphs into bullet summaries.",
    highlights: [
      "Integrated sidebar interface docked directly beside your Google Doc",
      "Single-click replace for corrected paragraphs and suggested headlines",
      "Built-in legacy UBIN16S font transcoder for older archives",
      "Deployed seamlessly across enterprise Google Workspace domains",
    ],
    ctaLabel: "View Docs Add-on Specs",
    ctaUrl: "https://github.com/wahallu/SinhalaJournalLLM/tree/main/apps/docs-addon",
    techStack: ["Google Apps Script", "clasp CLI", "REST Gateway"],
  },
];

export default function EcosystemTabs() {
  const [activeId, setActiveId] = useState<string>("webapp");

  const current = ECOSYSTEM_DATA.find((item) => item.id === activeId) || ECOSYSTEM_DATA[0];

  return (
    <section id="ecosystem" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-12 max-w-[1560px] mx-auto bg-[#FAF9F5]">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
        <span className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-[#cd191a] mb-2 sm:mb-3 block">
          Client Applications
        </span>
        <h2 className="font-display text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#181818] tracking-tight leading-tight mb-4 sm:mb-6">
          A unified suite built for modern newsrooms.
        </h2>
      </div>

      {/* Surface Selector Pills */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 sm:mb-12">
        {ECOSYSTEM_DATA.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveId(item.id)}
            className={`flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-3 rounded-full text-[11px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              activeId === item.id
                ? "bg-[#181818] text-white shadow-xl scale-105"
                : "bg-white text-[#615e58] border border-[#D9D7D0] hover:bg-[#F0EFEB] hover:text-[#181818]"
            }`}
          >
            {item.icon}
            <span>{item.title}</span>
          </button>
        ))}
      </div>

      {/* Active Ecosystem Card Showcase */}
      <div className="w-full max-w-5xl mx-auto bg-[#FFFDF8] rounded-2xl sm:rounded-[36px] p-5 sm:p-8 md:p-12 border border-[#D9D7D0] shadow-xl transition-all duration-300">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-center">
          {/* Left Column: Content */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2 sm:mb-3">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#cd191a]">
                  {current.category}
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-[#181818] text-white px-2 py-0.5 rounded-full">
                  {current.badge}
                </span>
              </div>

              <h3 className="font-display text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-[#181818] leading-tight mb-3 sm:mb-4">
                {current.headline}
              </h3>

              <p className="text-xs sm:text-sm md:text-base text-[#615e58] leading-relaxed mb-4 sm:mb-6">
                {current.description}
              </p>

              <div className="space-y-2 sm:space-y-2.5 mb-6 sm:mb-8">
                {current.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs sm:text-sm text-[#181818]">
                    <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#cd191a] shrink-0 mt-0.5" />
                    <span>{h}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 pt-4 sm:pt-6 border-t border-[#F0EFEB]">
              <a
                href={current.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 bg-[#181818] hover:bg-[#cd191a] text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-full text-xs font-bold uppercase tracking-wider shadow-md hover:shadow-lg transition-all"
              >
                <span>{current.ctaLabel}</span>
                <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </a>

              <div className="flex flex-wrap gap-1 sm:gap-1.5">
                {current.techStack.map((tech, idx) => (
                  <span
                    key={idx}
                    className="text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold text-[#8C8880] bg-[#F0EFEB] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Visual Preview Card */}
          <div className="lg:col-span-5 bg-gradient-to-br from-[#F0EFEB] to-[#E9E8E4] p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#D9D7D0] flex flex-col justify-center items-center text-center">
            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-white shadow-md border border-[#D9D7D0] flex items-center justify-center mb-3 sm:mb-4">
              {current.icon}
            </div>
            <h4 className="font-display text-lg sm:text-xl font-bold text-[#181818] mb-0.5 sm:mb-1">{current.title}</h4>
            <p className="text-[11px] sm:text-xs text-[#8C8880] mb-4 sm:mb-6">{current.category}</p>

            <div className="w-full bg-white/80 backdrop-blur-md rounded-xl sm:rounded-2xl p-3.5 sm:p-4 border border-[#D9D7D0] text-left shadow-sm">
              <div className="flex items-center justify-between text-xs font-bold text-[#181818] mb-2">
                <span>Status</span>
                <span className="text-emerald-600 flex items-center gap-1 text-[11px] sm:text-xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Production Ready
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-[#615e58] space-y-1">
                <div className="flex justify-between">
                  <span>Compatibility:</span>
                  <span className="font-semibold">Unicode & Legacy</span>
                </div>
                <div className="flex justify-between">
                  <span>Inference Latency:</span>
                  <span className="font-semibold">&lt; 800ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Data Isolation:</span>
                  <span className="font-semibold">Per-User RLS</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
