"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Cpu,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Crosshair,
  Sliders,
  SplitSquareHorizontal,
} from "lucide-react";
import Link from "next/link";

function ScrollTrackedSection({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicatorTop, setIndicatorTop] = useState<number>(0);
  const [indicatorHeight, setIndicatorHeight] = useState<number>(60);

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const items = container.querySelectorAll<HTMLElement>(".narrative-item");
      if (!items.length) return;

      const triggerY = window.innerHeight * 0.5;
      let bestIndex = 0;
      let minDistance = Infinity;

      items.forEach((item, index) => {
        const rect = item.getBoundingClientRect();
        const itemCenter = rect.top + rect.height / 2;
        const distance = Math.abs(itemCenter - triggerY);
        if (distance < minDistance) {
          minDistance = distance;
          bestIndex = index;
        }
      });

      const activeItem = items[bestIndex];
      if (activeItem) {
        const containerRect = container.getBoundingClientRect();
        const activeRect = activeItem.getBoundingClientRect();
        setIndicatorTop(activeRect.top - containerRect.top);
        setIndicatorHeight(activeRect.height);
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    handleScroll();
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative pl-5 sm:pl-8 border-l-[3px] border-[#D9D7D0] space-y-6 sm:space-y-8"
    >
      <div
        className="absolute left-[-3px] w-[3px] rounded-full bg-gradient-to-b from-[#cd191a] to-[#ff4b2b] transition-all duration-500 ease-out pointer-events-none"
        style={{
          top: `${indicatorTop}px`,
          height: `${indicatorHeight}px`,
        }}
      />
      {children}
    </div>
  );
}

export default function ResearchShowcase() {
  return (
    <section id="research" className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-12 max-w-[1560px] mx-auto bg-[#FAF9F5] scroll-mt-20 sm:scroll-mt-28">
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-20">
        <span className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-[#cd191a] mb-2 sm:mb-3 block">
          Deep Research & Architecture
        </span>
        <h2 className="font-display text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#181818] tracking-tight leading-tight mb-4 sm:mb-6">
          Architected for linguistic precision and enterprise scale.
        </h2>
        <p className="text-xs sm:text-base md:text-lg text-[#615e58] leading-relaxed">
          Behind SinAi is the Sinhala Journal LLM research foundation fine-tuned on millions of authentic Sinhala journalistic tokens, paired with high-throughput infrastructure.
        </p>
      </div>

      {/* Deep Dive 1: The Sinhala Journal Foundation & LoRA Adapters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-20 items-center mb-16 sm:mb-28">
        {/* Left: Interactive Visual Diagram */}
        <div className="bg-gradient-to-br from-[#F0EFEB] to-[#E9E8E4] rounded-2xl sm:rounded-[36px] p-4 sm:p-8 md:p-10 border border-[#D9D7D0] shadow-md flex flex-col justify-center min-h-[380px] sm:min-h-[460px] relative overflow-hidden">
          <div className="w-full bg-[#FFFDF8] rounded-xl sm:rounded-2xl shadow-xl border border-[#D9D7D0]/80 p-4 sm:p-6 md:p-8">
            <div className="flex items-center justify-between pb-3 sm:pb-4 mb-4 sm:mb-6 border-b border-[#F0EFEB]">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 sm:w-5 sm:h-5 text-[#cd191a]" />
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#181818]">
                  SinhalaJournal-Base
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-[#cd191a]/10 text-[#cd191a] px-2 py-0.5 rounded-full">
                Active Model
              </span>
            </div>

            {/* Adapters Flow Diagram */}
            <div className="space-y-2 sm:space-y-3">
              <div className="p-2.5 sm:p-3.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] flex items-center justify-between hover:border-[#cd191a] transition-colors">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#cd191a] shrink-0" />
                  <div>
                    <span className="text-[11px] sm:text-xs font-bold text-[#181818] block font-mono">
                      grammar_v13
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-[#8C8880]">
                      Inflection &amp; Subject-Verb Agreement
                    </span>
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-[#cd191a] font-mono">r=32</span>
              </div>

              <div className="p-2.5 sm:p-3.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] flex items-center justify-between hover:border-[#cd191a] transition-colors">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#ff4b2b] shrink-0" />
                  <div>
                    <span className="text-[11px] sm:text-xs font-bold text-[#181818] block font-mono">
                      headline_v17
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-[#8C8880]">
                      Front-Page Journalistic Angles &amp; Tickers
                    </span>
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-[#ff4b2b] font-mono">r=32</span>
              </div>

              <div className="p-2.5 sm:p-3.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] flex items-center justify-between hover:border-[#cd191a] transition-colors">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#8A2387] shrink-0" />
                  <div>
                    <span className="text-[11px] sm:text-xs font-bold text-[#181818] block font-mono">
                      style_v07
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-[#8C8880]">
                      5-Tone Register Transfer (Formal, Casual)
                    </span>
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-[#8A2387] font-mono">r=16</span>
              </div>

              <div className="p-2.5 sm:p-3.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] flex items-center justify-between hover:border-[#cd191a] transition-colors">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#F27121] shrink-0" />
                  <div>
                    <span className="text-[11px] sm:text-xs font-bold text-[#181818] block font-mono">
                      summarization_v04
                    </span>
                    <span className="text-[10px] sm:text-[11px] text-[#8C8880]">
                      Abstractive News Condensation &amp; Bullets
                    </span>
                  </div>
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-[#F27121] font-mono">r=32</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Narrative Details with Scroll-Tracked Vertical Red Line */}
        <div className="flex flex-col justify-center max-w-lg">
          <h3 className="font-display text-xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#181818] mb-6 sm:mb-8">
            LoRA Adaptation for Specialized Linguistic Tasks.
          </h3>

          <ScrollTrackedSection>
            <div className="narrative-item">
              <h4 className="text-sm sm:text-base md:text-lg font-bold text-[#181818] mb-1.5 sm:mb-2">
                Domain-Adapted Sinhala Tokenizer
              </h4>
              <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed">
                Standard tokenizers excessively fragment Sinhala unicode combining characters, multiplying token counts and degrading context. Our domain model preserves full morpheme integrity.
              </p>
            </div>

            <div className="narrative-item">
              <h4 className="text-sm sm:text-base md:text-lg font-bold text-[#181818] mb-1.5 sm:mb-2">
                Zero-Degradation Hot Adapter Swapping
              </h4>
              <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed">
                Our inference engine dynamically loads low-rank adapters in memory without reloading the base model, enabling sub-800ms switching between grammar, headlines, and style rewriting.
              </p>
            </div>

            <div className="narrative-item">
              <h4 className="text-sm sm:text-base md:text-lg font-bold text-[#181818] mb-1.5 sm:mb-2">
                Length-Conditioned Executive Summaries
              </h4>
              <p className="text-sm text-[#615e58] leading-relaxed">
                Abstractive compression trained with explicit length tokens to deliver concise 3-bullet executive briefs or detailed narrative syntheses without hallucination.
              </p>
            </div>
          </ScrollTrackedSection>
        </div>
      </div>

      {/* Model Capabilities Grid */}
      <div className="py-12 sm:py-16 md:py-20 border-t border-[#F0EFEB] mt-12 sm:mt-16 md:mt-24">
        <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
          <span className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-[#cd191a] mb-2 sm:mb-3 block">
            Core AI Models
          </span>
          <h3 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#181818]">
            Explore the Specialized Adapters
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          <Link href="/research/grammar-checker" className="group block bg-white rounded-xl sm:rounded-2xl p-5 border border-[#D9D7D0] hover:border-[#cd191a]/30 hover:shadow-lg transition-all duration-300 flex flex-col h-full">
            <div className="w-10 h-10 rounded-lg bg-[#fdf3f2] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shrink-0">
              <CheckCircle2 className="w-5 h-5 text-[#cd191a]" />
            </div>
            <h4 className="font-display text-lg font-bold text-[#181818] mb-2 leading-tight">Grammar Checker</h4>
            <p className="text-xs text-[#615e58] leading-relaxed mb-4 flex-grow">
              Precision error correction. Trained on 36K+ curated examples to achieve a low 6.7% over-correction rate.
            </p>
            <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-[#cd191a] gap-1.5 mt-auto">
              Learn More <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link href="/research/headline-generator" className="group block bg-white rounded-xl sm:rounded-2xl p-5 border border-[#D9D7D0] hover:border-[#cd191a]/30 hover:shadow-lg transition-all duration-300 flex flex-col h-full">
            <div className="w-10 h-10 rounded-lg bg-[#fdf3f2] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shrink-0">
              <Crosshair className="w-5 h-5 text-[#cd191a]" />
            </div>
            <h4 className="font-display text-lg font-bold text-[#181818] mb-2 leading-tight">Headline Generator</h4>
            <p className="text-xs text-[#615e58] leading-relaxed mb-4 flex-grow">
              Length-conditioned headlines across three strict bands with a near-zero artifact rate.
            </p>
            <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-[#cd191a] gap-1.5 mt-auto">
              Learn More <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link href="/research/style-rewriter" className="group block bg-white rounded-xl sm:rounded-2xl p-5 border border-[#D9D7D0] hover:border-[#cd191a]/30 hover:shadow-lg transition-all duration-300 flex flex-col h-full">
            <div className="w-10 h-10 rounded-lg bg-[#fdf3f2] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shrink-0">
              <Sliders className="w-5 h-5 text-[#cd191a]" />
            </div>
            <h4 className="font-display text-lg font-bold text-[#181818] mb-2 leading-tight">Style Rewriter</h4>
            <p className="text-xs text-[#615e58] leading-relaxed mb-4 flex-grow">
              Dynamically shifts article tone between 5 distinct newspaper styles without hallucinating details.
            </p>
            <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-[#cd191a] gap-1.5 mt-auto">
              Learn More <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link href="/research/news-summarizer" className="group block bg-white rounded-xl sm:rounded-2xl p-5 border border-[#D9D7D0] hover:border-[#cd191a]/30 hover:shadow-lg transition-all duration-300 flex flex-col h-full">
            <div className="w-10 h-10 rounded-lg bg-[#fdf3f2] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shrink-0">
              <SplitSquareHorizontal className="w-5 h-5 text-[#cd191a]" />
            </div>
            <h4 className="font-display text-lg font-bold text-[#181818] mb-2 leading-tight">News Summarizer</h4>
            <p className="text-xs text-[#615e58] leading-relaxed mb-4 flex-grow">
              Abstractive compression model natively trained on Chat formats to produce executive briefs.
            </p>
            <div className="flex items-center text-[10px] font-bold uppercase tracking-wider text-[#cd191a] gap-1.5 mt-auto">
              Learn More <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

      {/* Deep Dive 2: Security & Row-Level Isolation */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-12 lg:gap-20 items-center">
        {/* Left: Narrative Details with Scroll-Tracked Vertical Red Line */}
        <div className="flex flex-col justify-center max-w-lg order-2 lg:order-1">
          <h3 className="font-display text-xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#181818] mb-6 sm:mb-8">
            Newsroom-Grade Security &amp; Row-Level Isolation.
          </h3>

          <ScrollTrackedSection>
            <div className="narrative-item">
              <h4 className="text-sm sm:text-base md:text-lg font-bold text-[#181818] mb-1.5 sm:mb-2">
                Postgres Row-Level Security (RLS)
              </h4>
              <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed">
                Every news draft, grammar check, and headline generation is strictly locked to the author&apos;s authenticated UUID. Isolation is enforced at the database kernel level, preventing any cross-journalist leaks.
              </p>
            </div>

            <div className="narrative-item">
              <h4 className="text-sm sm:text-base md:text-lg font-bold text-[#181818] mb-1.5 sm:mb-2">
                Privacy-Preserving Hashed Telemetry
              </h4>
              <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed">
                Anonymous callers are rate-limited via salted cryptographic hashes (`sha256(ip + salt)`). Raw IP addresses and article contents are never stored on unauthenticated sessions.
              </p>
            </div>

            <div className="narrative-item">
              <h4 className="text-sm sm:text-base md:text-lg font-bold text-[#181818] mb-1.5 sm:mb-2">
                Reliable Model Gateway &amp; Failover
              </h4>
              <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed">
                Built-in automatic fallback routing between dedicated GPU clusters and secondary endpoints for high availability during breaking news cycles.
              </p>
            </div>
          </ScrollTrackedSection>
        </div>

        {/* Right: Security Diagram */}
        <div className="bg-gradient-to-tr from-[#181818] to-[#121212] rounded-2xl sm:rounded-[36px] p-4 sm:p-8 md:p-10 border border-white/10 shadow-2xl flex flex-col justify-center min-h-[380px] sm:min-h-[460px] text-white order-1 lg:order-2 relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-36 sm:w-48 h-36 sm:h-48 bg-[#cd191a]/30 rounded-full blur-3xl pointer-events-none" />

          <div className="w-full bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-white/10 p-4 sm:p-6 md:p-8">
            <div className="flex items-center justify-between pb-3 sm:pb-4 mb-4 sm:mb-6 border-b border-white/10">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 text-[#ff8a8a]" />
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-white">
                  Security Perimeter
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
                Guarded
              </span>
            </div>

            {/* Architecture stack */}
            <div className="space-y-2 sm:space-y-3 font-mono text-[10px] sm:text-xs">
              <div className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-white/80">1. Client Request (JWT Verified)</span>
                <span className="text-emerald-400">RS256 / JWKS</span>
              </div>
              <div className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-white/80">2. Supabase PostgREST Layer</span>
                <span className="text-emerald-400">auth.uid() = user_id</span>
              </div>
              <div className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-white/80">3. IP Salted Rate Limiter</span>
                <span className="text-[#ff8a8a]">sha256(ip + salt)</span>
              </div>
              <div className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
                <span className="text-white/80">4. Gateway Model Router</span>
                <span className="text-emerald-400">GPU Cluster</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

