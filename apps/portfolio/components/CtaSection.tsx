"use client";

import React from "react";
import { ArrowUpRight, Sparkles, Code2 } from "lucide-react";

export default function CtaSection() {
  return (
    <section className="py-20 sm:py-28 md:py-40 px-4 sm:px-6 lg:px-12 max-w-[1560px] mx-auto bg-[#FAF9F5]">
      <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* Brand Icon Mark */}
        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-[#cd191a] to-[#8d1213] flex items-center justify-center mb-6 sm:mb-8 shadow-xl shadow-[#cd191a]/20">
          <span className="text-white font-display font-bold text-lg sm:text-2xl leading-none">S</span>
        </div>

        {/* Big Impact Headline */}
        <h2 className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-[#181818] tracking-tight leading-[1.1] sm:leading-[1.08] mb-6 sm:mb-8 text-balance">
          Experience the future of Sinhala language intelligence.
        </h2>

        <p className="text-xs sm:text-base md:text-lg text-[#615e58] max-w-2xl mx-auto leading-relaxed mb-8 sm:mb-12 text-balance px-2">
          Start using SinAi today in our live web workspace, install the Chrome browser assistant, or integrate directly with your newsroom Google Docs.
        </p>

        {/* Dual Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 w-full sm:w-auto px-2">
          <a
            href="http://localhost:5173"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#181818] hover:bg-[#cd191a] text-white px-5 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-xs sm:text-sm uppercase tracking-wider shadow-2xl hover:shadow-[#cd191a]/35 transition-all duration-300 hover:scale-105 active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ff8a8a]" />
            <span>Launch Web App Playground</span>
            <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </a>

          <a
            href="https://github.com/wahallu/SinhalaJournalLLM"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-[#F0EFEB] text-[#181818] border border-[#D9D7D0] px-5 sm:px-7 py-3 sm:py-4 rounded-full font-bold text-xs sm:text-sm uppercase tracking-wider shadow-sm transition-all duration-200"
          >
            <Code2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8C8880]" />
            <span>GitHub Repository</span>
          </a>
        </div>
      </div>
    </section>
  );
}
