import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowLeft, CheckCircle2, Sliders, Zap, BookOpen } from "lucide-react";
import Link from "next/link";

export default function StyleRewriterPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] text-[#1B1B1B]">
      <Navbar />

      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Back Navigation */}
          <div className="mb-8">
            <Link 
              href="/#research-models" 
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#8C8880] hover:text-[#cd191a] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Link>
          </div>

          {/* Hero Section */}
          <div className="mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#fdf3f2] text-[#cd191a] text-xs font-bold uppercase tracking-widest mb-6">
              <span className="w-2 h-2 rounded-full bg-[#cd191a] animate-pulse" />
              Linguistic Register Control
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-[#181818] tracking-tight leading-tight mb-6">
              Style & Tone Rewriter
            </h1>
            <p className="text-lg sm:text-xl text-[#615e58] max-w-3xl leading-relaxed">
              Dynamically shift the linguistic register of Sinhala news articles. Rewrite content instantly into one of five distinct newspaper styles, matching the target demographic without altering the underlying facts.
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#fdf3f2] flex items-center justify-center mb-4">
                <Sliders className="w-5 h-5 text-[#cd191a]" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Registers</p>
              <p className="text-3xl font-display font-bold text-[#181818]">5</p>
              <p className="text-xs text-[#615e58] mt-2">Distinct editorial tone styles</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#fdf3f2] flex items-center justify-center mb-4">
                <Zap className="w-5 h-5 text-[#cd191a]" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Latency</p>
              <p className="text-3xl font-display font-bold text-[#181818]">&lt;800ms</p>
              <p className="text-xs text-[#615e58] mt-2">Adapter switching overhead</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#fdf3f2] flex items-center justify-center mb-4">
                <BookOpen className="w-5 h-5 text-[#cd191a]" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Fact Fidelity</p>
              <p className="text-3xl font-display font-bold text-[#181818]">High</p>
              <p className="text-xs text-[#615e58] mt-2">Preserves journalistic accuracy</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#181818] flex items-center justify-center mb-4">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Adapter Version</p>
              <p className="text-3xl font-display font-bold text-[#181818]">v07</p>
              <p className="text-xs text-[#615e58] mt-2">Current production deployment</p>
            </div>
          </div>

          {/* Deep Dive Content */}
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D9D7D0] shadow-lg">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#181818] mb-8 border-b border-[#F0EFEB] pb-4">
              Supported Editorial Styles
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              <div className="bg-[#FAF9F5] p-6 rounded-2xl border border-[#D9D7D0]">
                <h4 className="font-bold text-[#181818] text-lg mb-2">Formal News</h4>
                <p className="text-sm text-[#615e58]">Standard broadcast and broadsheet tone. Objective, structured, and strictly adheres to formal journalistic syntax.</p>
              </div>
              
              <div className="bg-[#FAF9F5] p-6 rounded-2xl border border-[#D9D7D0]">
                <h4 className="font-bold text-[#181818] text-lg mb-2">Sports Reporting</h4>
                <p className="text-sm text-[#615e58]">Dynamic and action-oriented vocabulary. Adapts verbs and pacing to match the excitement of live sports coverage.</p>
              </div>
              
              <div className="bg-[#FAF9F5] p-6 rounded-2xl border border-[#D9D7D0]">
                <h4 className="font-bold text-[#181818] text-lg mb-2">Youth & Culture</h4>
                <p className="text-sm text-[#615e58]">Engaging, modern vernacular tailored for younger demographics and digital-first tabloid formats.</p>
              </div>
              
              <div className="bg-[#FAF9F5] p-6 rounded-2xl border border-[#D9D7D0]">
                <h4 className="font-bold text-[#181818] text-lg mb-2">Editorial Opinion</h4>
                <p className="text-sm text-[#615e58]">Authoritative, persuasive, and reflective. Enhances sentences with richer adjectives to convey a strong viewpoint.</p>
              </div>
              
              <div className="bg-[#FAF9F5] p-6 rounded-2xl border border-[#D9D7D0]">
                <h4 className="font-bold text-[#181818] text-lg mb-2">Feature Story</h4>
                <p className="text-sm text-[#615e58]">Narrative-driven and descriptive. Prioritizes storytelling flow and immersive language for long-form reading.</p>
              </div>
            </div>
            
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#181818] mb-8 border-b border-[#F0EFEB] pb-4">
              Zero-Degradation Hot Swapping
            </h2>
            
            <div className="max-w-3xl">
              <p className="text-[#615e58] leading-relaxed mb-6">
                Unlike traditional monolithic deployments where every distinct task requires an entirely separate 8-billion-parameter model to be loaded into VRAM, SinAi utilizes a shared pre-merged foundational base (<code>SinLLaMA-merged-base</code>). 
              </p>
              <p className="text-[#615e58] leading-relaxed mb-6">
                The Style Rewriter, alongside the grammar and summarization tools, is deployed as a highly optimized, lightweight Low-Rank Adaptation (LoRA) adapter. Our inference server (<code>serve_sinai.py</code>) dynamically swaps these adapters into the active context in milliseconds.
              </p>
              <div className="bg-[#181818] text-white p-6 rounded-2xl shadow-inner mt-8">
                <p className="font-semibold mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-400" />
                  Efficiency Gain
                </p>
                <p className="text-sm text-white/80">
                  This architecture allows a single GPU to serve all four major SinAi AI features concurrently without memory exhaustion, supporting rapid tone adjustments without user-facing loading delays.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
