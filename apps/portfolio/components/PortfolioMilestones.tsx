"use client";

import Timeline from "@/components/ui/timeline";

export default function PortfolioMilestones() {
  return (
    <div
      id="milestones"
      data-nav-theme="dark"
      className="relative w-full bg-[#141414] text-white"
    >
      <div className="border-t border-white/10 pb-4 pt-24 sm:pt-32">
        <h2 className="mx-auto max-w-4xl px-5 text-center font-display text-3xl font-bold tracking-tight text-white sm:px-8 sm:text-5xl">
          Milestones
        </h2>
      </div>

      <Timeline
        backgroundColor="#141414"
        textColor="#FAF9F5"
        mutedTextColor="#A39E93"
        activeColor="#cd191a"
      />
    </div>
  );
}
