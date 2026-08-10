"use client";

import React from "react";
import { Sparkles, Shield, Award, Newspaper, BookOpen, Layers } from "lucide-react";

export default function TrustStrip() {
  const stats = [
    {
      icon: <Layers className="w-4 h-4 text-[#cd191a]" />,
      title: "Sinhala Journal Foundation",
      desc: "Trained on millions of journalistic tokens",
    },
    {
      icon: <Award className="w-4 h-4 text-[#cd191a]" />,
      title: "4 Specialized LoRA Adapters",
      desc: "Grammar, Headlines, Style & Summary",
    },
    {
      icon: <Shield className="w-4 h-4 text-[#cd191a]" />,
      title: "Newsroom Data Privacy",
      desc: "Row-Level Security & Encrypted Gateway",
    },
    {
      icon: <Newspaper className="w-4 h-4 text-[#cd191a]" />,
      title: "10,000 Char Context",
      desc: "Full long-form news article processing",
    },
    {
      icon: <Sparkles className="w-4 h-4 text-[#cd191a]" />,
      title: "Sub-800ms Latency",
      desc: "Instant GPU acceleration for breaking news",
    },
    {
      icon: <BookOpen className="w-4 h-4 text-[#cd191a]" />,
      title: "Legacy Font Transcoder",
      desc: "Built-in UBIN/FM ASCII newsroom support",
    },
  ];

  return (
    <div className="w-full bg-[#181818] py-6 sm:py-8 border-y border-white/10 overflow-hidden relative select-none">
      {/* Subtle edge fades */}
      <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-r from-[#181818] to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-l from-[#181818] to-transparent z-10 pointer-events-none" />

      {/* Marquee Track (CSS animated in globals.css) */}
      <div className="flex w-max animate-marquee gap-8 sm:gap-12 items-center">
        {/* Double array to make seamless loop */}
        {[...stats, ...stats].map((stat, idx) => (
          <div
            key={idx}
            className="flex items-center gap-3 bg-white/5 border border-white/10 px-5 sm:px-6 py-2.5 sm:py-3 rounded-full shrink-0 hover:bg-white/10 transition-colors"
          >
            <div className="p-1.5 rounded-full bg-white/10 flex items-center justify-center">
              {stat.icon}
            </div>
            <div className="flex flex-col">
              <span className="text-white text-xs sm:text-sm font-bold tracking-tight">
                {stat.title}
              </span>
              <span className="text-white/60 text-[10px] sm:text-xs">
                {stat.desc}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
