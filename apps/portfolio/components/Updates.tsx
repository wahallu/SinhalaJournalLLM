"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";

export default function Updates() {
  const articles = [
    {
      tag: "Research Paper",
      date: "August 2026",
      title: "Domain Adaptation of Large Language Models for Morphologically Rich Low-Resource Indic Languages",
      desc: "An in-depth analysis of tokenizer optimization and low-rank parameter efficiency for Sinhala journalistic corpora.",
      link: "https://github.com/wahallu/SinhalaJournalLLM",
    },
    {
      tag: "Release Notes",
      date: "August 2026",
      title: "Announcing SinLLaMA 2.4: Sub-Second Latency & Multi-LoRA Swapping",
      desc: "Deploying upgraded grammar_v13 and headline_v17 adapters with Postgres Row-Level Security across our client apps.",
      link: "https://github.com/wahallu/SinhalaJournalLLM",
    },
    {
      tag: "Newsroom Guide",
      date: "July 2026",
      title: "Modernizing Newsroom Workflows with Chrome Extension & Google Docs AI",
      desc: "How Sri Lankan media organizations integrate SinAi directly into their CMS and Google Docs collaborative editing pipelines.",
      link: "https://github.com/wahallu/SinhalaJournalLLM",
    },
  ];

  return (
    <section className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-12 max-w-[1560px] mx-auto bg-[#FAF9F5] border-t border-[#D9D7D0]/60">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 mb-10 sm:mb-14 max-w-5xl mx-auto">
        <div>
          <span className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-[#cd191a] mb-1.5 sm:mb-2 block">
            Research &amp; Publications
          </span>
          <h2 className="font-display text-2xl sm:text-4xl md:text-5xl font-bold text-[#181818] tracking-tight">
            Latest Updates
          </h2>
        </div>
        <a
          href="https://github.com/wahallu/SinhalaJournalLLM"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#181818] hover:text-[#cd191a] border-b border-[#181818] hover:border-[#cd191a] pb-0.5 sm:pb-1 transition-colors self-start sm:self-auto"
        >
          <span>View GitHub Repo</span>
          <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
        {articles.map((item, idx) => (
          <a
            key={idx}
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-[#D9D7D0] shadow-sm hover:border-[#cd191a]/50 hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between text-[11px] sm:text-xs text-[#8C8880] mb-3 sm:mb-4">
                <span className="font-bold text-[#cd191a] uppercase tracking-wider">{item.tag}</span>
                <span>{item.date}</span>
              </div>
              <h3 className="font-display text-base sm:text-xl font-bold text-[#181818] group-hover:text-[#cd191a] transition-colors leading-snug mb-2 sm:mb-3">
                {item.title}
              </h3>
              <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed mb-4 sm:mb-6">
                {item.desc}
              </p>
            </div>

            <div className="flex items-center gap-1 text-xs font-bold text-[#181818] group-hover:text-[#cd191a] transition-colors pt-3 sm:pt-4 border-t border-[#F0EFEB]">
              <span>Read article</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
