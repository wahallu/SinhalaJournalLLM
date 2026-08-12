import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowLeft, CheckCircle2, ShieldCheck, Cpu, Database, Zap } from "lucide-react";
import Link from "next/link";

export default function GrammarCheckerPage() {
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
              Model Architecture
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-[#181818] tracking-tight leading-tight mb-6">
              Sinhala Grammar Checker
            </h1>
            <p className="text-lg sm:text-xl text-[#615e58] max-w-3xl leading-relaxed">
              A specialized LoRA fine-tune of SinLlama designed for Sinhala journalism. Engineered to fix real editorial errors without rewriting the journalist's sentence—preserving meaning and stylistic intent.
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#fdf3f2] flex items-center justify-center mb-4">
                <CheckCircle2 className="w-5 h-5 text-[#cd191a]" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Accuracy</p>
              <p className="text-3xl font-display font-bold text-[#181818]">87.7%</p>
              <p className="text-xs text-[#615e58] mt-2">Stage 2 Overall Accuracy</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#fdf3f2] flex items-center justify-center mb-4">
                <ShieldCheck className="w-5 h-5 text-[#cd191a]" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Over-Correction</p>
              <p className="text-3xl font-display font-bold text-[#181818]">6.7%</p>
              <p className="text-xs text-[#615e58] mt-2">Strict exact string match</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#fdf3f2] flex items-center justify-center mb-4">
                <Database className="w-5 h-5 text-[#cd191a]" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Training Data</p>
              <p className="text-3xl font-display font-bold text-[#181818]">36K+</p>
              <p className="text-xs text-[#615e58] mt-2">Hand-curated examples</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#181818] flex items-center justify-center mb-4">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Adapter Version</p>
              <p className="text-3xl font-display font-bold text-[#181818]">v22</p>
              <p className="text-xs text-[#615e58] mt-2">Current production deployment</p>
            </div>
          </div>

          {/* Deep Dive Content */}
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D9D7D0] shadow-lg">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#181818] mb-8 border-b border-[#F0EFEB] pb-4">
              Training & Architecture Details
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div>
                <h3 className="text-xl font-bold text-[#181818] mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#cd191a]" />
                  LoRA Configuration
                </h3>
                <p className="text-[#615e58] leading-relaxed mb-6">
                  Trained via Unsloth and TRL SFTTrainer, targeting both attention and MLP layers (q, k, v, o_proj + gate, up, down_proj) with rank r=32. Applying LoRA to MLP layers proved crucial for resolving lexical bugs (e.g., verb-stem selection) that attention-only adapters missed.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#cd191a] mt-2 shrink-0" />
                    <span className="text-[#1B1B1B]"><strong className="font-semibold text-[#181818]">Loss Function:</strong> Completion-only loss ensures the model focuses entirely on the corrected response tokens, preventing wasted gradient steps on the instruction text.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#cd191a] mt-2 shrink-0" />
                    <span className="text-[#1B1B1B]"><strong className="font-semibold text-[#181818]">Compute Profile:</strong> 5 epochs, effective batch size of 8 (2 × 4 grad-accum), lr 5e-5 cosine schedule. Requires ~1h20m on a single NVIDIA A40 GPU.</span>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold text-[#181818] mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-[#cd191a]" />
                  Dataset Engineering
                </h3>
                <p className="text-[#615e58] leading-relaxed mb-6">
                  The model relies on 36,006 rows of highly curated, deduplicated data (<code>cleaned_v9_full.jsonl</code>). The dataset is composed of strictly isolated, rule-specific files to prevent regressions.
                </p>
                <ul className="space-y-3 text-sm text-[#1B1B1B]">
                  <li className="flex justify-between items-center py-2 border-b border-[#F0EFEB]">
                    <span>Spelling & Confusables (ණ/න, ළ/ල)</span>
                  </li>
                  <li className="flex justify-between items-center py-2 border-b border-[#F0EFEB]">
                    <span>Already-Correct Sentences (Control set)</span>
                  </li>
                  <li className="flex justify-between items-center py-2 border-b border-[#F0EFEB]">
                    <span>Subject-Object-Verb (SOV) order</span>
                  </li>
                  <li className="flex justify-between items-center py-2 border-b border-[#F0EFEB]">
                    <span>Literary Plural Verb Agreement</span>
                  </li>
                </ul>
                <p className="text-xs text-[#8C8880] mt-4 italic">
                  Note: The changed/unchanged ratio is held strictly near 65/35 to prevent the model from always assuming an edit is required, which drives down over-correction rates.
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
