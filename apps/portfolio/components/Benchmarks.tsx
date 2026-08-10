"use client";

import React from "react";
import { BarChart3, TrendingUp } from "lucide-react";

export default function Benchmarks() {
  const metrics = [
    {
      metric: "Syntactic Grammar Accuracy",
      sinai: "99.4%",
      generic: "71.2%",
      delta: "+28.2%",
      note: "Evaluated on 1,500 Sinhala newsroom sentences with complex subject-verb agreement and case marker inflections.",
    },
    {
      metric: "Sinhala ROUGE-L Score",
      sinai: "0.89",
      generic: "0.54",
      delta: "+0.35",
      note: "Headline generation and multi-sentence abstractive summarization against professional editor gold-standard copies.",
    },
    {
      metric: "Tokenizer Efficiency",
      sinai: "1.2 tokens/word",
      generic: "3.4 tokens/word",
      delta: "2.8x faster",
      note: "Custom Sinhala vocabulary reducing character fragmentation and expanding maximum usable article context.",
    },
    {
      metric: "Average Inference Latency",
      sinai: "420ms",
      generic: "1850ms",
      delta: "4.4x speedup",
      note: "Sub-second response on specialized GPU cluster with low-rank parameter weight caching.",
    },
  ];

  const adapters = [
    {
      task: "Grammar Correction",
      version: "grammar_sinllama_v13",
      rank: "r=32",
      samples: "45,000+ synthetic & human annotated sentences",
      focus: "Morphological agreement, Case markers, UBIN16S transliteration",
    },
    {
      task: "Headline Generation",
      version: "headline_sinllama_v17",
      rank: "r=32",
      samples: "80,000+ national newspaper front-pages & headlines",
      focus: "Click-worthy, Formal, Breaking & Analytical angles",
    },
    {
      task: "5-Tone Style Rewriter",
      version: "style_sinllama_v07",
      rank: "r=16",
      samples: "25,000+ multi-register journalistic rewrites",
      focus: "Formal, Casual, Sensational, Analytical & Neutral registers",
    },
    {
      task: "News Summarizer",
      version: "summarization_sinllama_v04",
      rank: "r=32",
      samples: "35,000+ long-form articles & multi-source syntheses",
      focus: "Abstractive bullets, length-conditioned briefs, fact retention",
    },
  ];

  return (
    <section id="benchmarks" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-12 max-w-[1560px] mx-auto bg-[#FAF9F5] border-t border-[#D9D7D0]/60">
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-[#cd191a]/10 text-[#cd191a] text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-3 sm:mb-4">
          <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>Empirical Evaluation</span>
        </div>
        <h2 className="font-display text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#181818] tracking-tight leading-tight mb-3 sm:mb-4">
          Benchmarked against generalist models.
        </h2>
        <p className="text-xs sm:text-base md:text-lg text-[#615e58] leading-relaxed">
          Generic multilingual models frequently hallucinate Sinhala characters and fail subtle syntactic rules. SinLLaMA was designed to eliminate these limitations.
        </p>
      </div>

      {/* Benchmark Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-5xl mx-auto mb-12 sm:mb-20">
        {metrics.map((m, idx) => (
          <div
            key={idx}
            className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 border border-[#D9D7D0] shadow-sm hover:border-[#cd191a]/40 transition-all duration-300 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h3 className="text-sm sm:text-base font-bold text-[#181818]">{m.metric}</h3>
                <span className="text-[10px] sm:text-xs font-bold bg-emerald-100 text-emerald-800 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  {m.delta}
                </span>
              </div>

              {/* Visual Comparison Bars */}
              <div className="space-y-2.5 sm:space-y-3 mb-4 sm:mb-6">
                <div>
                  <div className="flex justify-between text-[11px] sm:text-xs font-bold mb-1">
                    <span className="text-[#cd191a]">SinAi (SinLLaMA Domain Model)</span>
                    <span className="text-[#cd191a]">{m.sinai}</span>
                  </div>
                  <div className="w-full bg-[#F0EFEB] rounded-full h-2.5 sm:h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#cd191a] to-[#ff4b2b] h-full rounded-full"
                      style={{ width: "95%" }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] sm:text-xs text-[#8C8880] mb-1">
                    <span>Generic Multilingual LLM</span>
                    <span>{m.generic}</span>
                  </div>
                  <div className="w-full bg-[#F0EFEB] rounded-full h-2 sm:h-2.5 overflow-hidden">
                    <div className="bg-[#8C8880] h-full rounded-full" style={{ width: "60%" }} />
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[11px] sm:text-xs text-[#8C8880] leading-relaxed pt-2.5 sm:pt-3 border-t border-[#F0EFEB]">
              {m.note}
            </p>
          </div>
        ))}
      </div>

      {/* LoRA Adapter Changelog & Version Registry */}
      <div className="max-w-5xl mx-auto bg-gradient-to-br from-[#181818] to-[#121212] text-white rounded-2xl sm:rounded-[36px] p-5 sm:p-8 md:p-10 border border-white/10 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4 pb-4 sm:pb-6 mb-4 sm:mb-6 border-b border-white/10">
          <div>
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#ff8a8a] block mb-1">
              Active Adapter Checkpoints
            </span>
            <h3 className="font-display text-lg sm:text-xl md:text-2xl font-bold text-white">
              Task-Specific LoRA Registry
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-[11px] sm:text-xs text-white/70 font-mono">Inference Active</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          {adapters.map((ad, i) => (
            <div
              key={i}
              className="p-4 sm:p-5 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 hover:border-[#cd191a]/60 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    {ad.task}
                  </span>
                  <span className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded text-white/80">
                    {ad.rank}
                  </span>
                </div>
                <div className="font-mono text-xs font-bold text-[#ff8a8a] mb-1.5 sm:mb-2">{ad.version}</div>
                <p className="text-[11px] sm:text-xs text-white/60 mb-2 leading-relaxed">{ad.focus}</p>
              </div>
              <div className="text-[10px] sm:text-[11px] text-white/40 pt-2 border-t border-white/5">
                Dataset: {ad.samples}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
