"use client";

import React from "react";
import { Cpu, Zap, CheckCircle2, Shield, Globe, Award, Sparkles } from "lucide-react";

export default function TrustStrip() {
  const stats = [
    {
      icon: <Cpu className="w-4 h-4 text-[#cd191a]" />,
      title: "SinLLaMA Domain Base",
      desc: "Custom-adapted Sinhala Tokenizer & Weights",
    },
    {
      icon: <Zap className="w-4 h-4 text-[#cd191a]" />,
      title: "4 Specialized LoRA Adapters",
      desc: "Grammar v13, Headline v17, Style v07, Summary v04",
    },
    {
      icon: <CheckCircle2 className="w-4 h-4 text-[#cd191a]" />,
      title: "10,000 Character Context",
      desc: "Full long-form news investigative articles",
    },
    {
      icon: <Globe className="w-4 h-4 text-[#cd191a]" />,
      title: "Dual Typography Engine",
      desc: "Native Unicode & Legacy UBIN16S Newsroom fonts",
    },
    {
      icon: <Shield className="w-4 h-4 text-[#cd191a]" />,
      title: "Enterprise Row-Level Security",
      desc: "Supabase JWTs, PostgREST RLS, zero data leakage",
    },
    {
      icon: <Sparkles className="w-4 h-4 text-[#cd191a]" />,
      title: "Sub-Second Inferences",
      desc: "Optimized GPU model serving with vLLM / PyTorch",
    },
  ];

  const newsrooms = [
    "National Newspapers",
    "Digital News Portals",
    "Broadcast Journalists",
    "Academic Linguistics Labs",
    "Editorial Desks",
    "Independent Columnists",
    "Publishing Houses",
  ];

  return (
    <section className="py-12 border-y border-[#D9D7D0]/60 bg-[#FAF9F5] overflow-hidden">
      <div className="max-w-[1560px] mx-auto px-4 sm:px-6 lg:px-12">
        {/* Top Mini Label */}
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-widest text-[#8C8880] font-bold">
            Pioneering Sinhala Language Intelligence & Newsroom Architecture
          </p>
        </div>

        {/* Marquee 1: Model & Architecture Strengths */}
        <div className="marquee-container mb-8">
          <div className="animate-marquee flex items-center gap-8">
            {stats.concat(stats).map((item, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3.5 px-5 py-3 rounded-2xl bg-white border border-[#D9D7D0]/80 shadow-sm shrink-0 hover:border-[#cd191a]/40 transition-colors"
              >
                <div className="p-2 rounded-xl bg-[#cd191a]/10 shrink-0">{item.icon}</div>
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-[#181818] tracking-tight">{item.title}</span>
                  <span className="text-[11px] text-[#8C8880] font-medium">{item.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Marquee 2: Media and Newsroom Adoption Tags */}
        <div className="marquee-container" style={{ direction: "rtl" }}>
          <div className="animate-marquee flex items-center gap-6">
            {newsrooms.concat(newsrooms).map((outlet, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F0EFEB] border border-[#D9D7D0] text-[#615e58] text-xs font-bold uppercase tracking-wider shrink-0"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#cd191a]" />
                <span>{outlet}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
