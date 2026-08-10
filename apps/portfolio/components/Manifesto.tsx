"use client";

import React from "react";

export default function Manifesto() {
  return (
    <section className="relative py-20 sm:py-28 md:py-40 px-4 sm:px-6 lg:px-12 max-w-[1560px] mx-auto overflow-hidden bg-[#FAF9F5] border-t border-[#D9D7D0]/40">
      {/* Background Geometric Celestial SVG Rings */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] sm:w-[500px] md:w-[700px] h-[340px] sm:h-[500px] md:h-[700px] opacity-15 pointer-events-none -z-0">
        <svg className="w-full h-full animate-spin" style={{ animationDuration: "120s" }} fill="none" stroke="url(#manifesto-grad)" strokeWidth="0.6" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="manifesto-grad" x1="0%" x2="100%" y1="0%" y2="100%">
              <stop offset="0%" stopColor="#cd191a" />
              <stop offset="50%" stopColor="#ff4b2b" />
              <stop offset="100%" stopColor="#8d1213" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" />
          <ellipse cx="50" cy="50" rx="24" ry="48" />
          <ellipse cx="50" cy="50" rx="48" ry="24" />
          <line x1="2" x2="98" y1="50" y2="50" />
          <line x1="50" x2="50" y1="2" y2="98" />
        </svg>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto text-center flex flex-col items-center">
        {/* Label */}
        <div className="inline-flex items-center gap-2 px-3 sm:px-3.5 py-1 rounded-full bg-[#cd191a]/10 text-[#cd191a] text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-6 sm:mb-8 border border-[#cd191a]/20">
          <span>The SinAi Editorial Philosophy</span>
        </div>

        {/* Editorial Statement */}
        <blockquote className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-[52px] font-normal leading-[1.2] sm:leading-[1.2] text-[#181818] tracking-tight text-balance mb-6 sm:mb-10">
          &ldquo;As AI models transform global media, preserving the syntactic beauty, cultural nuance, and journalistic integrity of the{" "}
          <span className="italic text-[#cd191a] font-medium">Sinhala language</span> has never been more urgent. SinAi bridges deep linguistic heritage with state-of-the-art foundation intelligence.&rdquo;
        </blockquote>

        {/* Subtitle */}
        <p className="text-xs sm:text-base md:text-lg text-[#615e58] max-w-2xl mx-auto leading-relaxed">
          From newsroom deadline pressures to academic reporting, our mission is to empower journalists with AI tools that respect authentic grammatical rules and editorial registers.
        </p>
      </div>
    </section>
  );
}
