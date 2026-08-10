"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Heading,
  Wand2,
  FileText,
  Copy,
  Check,
  Zap,
  Cpu,
} from "lucide-react";

type ToolType = "grammar" | "headlines" | "rewriter" | "summarizer";

interface SampleData {
  tool: ToolType;
  title: string;
  badge: string;
  inputLabel: string;
  input: string;
  outputLabel: string;
  output: string | string[];
  annotations?: string[];
  metrics?: { label: string; val: string }[];
}

const SAMPLES: Record<ToolType, SampleData> = {
  grammar: {
    tool: "grammar",
    title: "Syntactic & Morphological Grammar Checker",
    badge: "LoRA v13 • Syntactic Parsing",
    inputLabel: "Original Draft (with grammatical and inflectional errors)",
    input:
      "ජනාධිපතිවරයා ඊයේ පැවති උත්සවයේදී නව ආර්ථික ප්‍රතිපත්තිය ප්‍රකාශ කළාය. රටේ සංවර්ධනය සඳහා සියලු ජනතාව එක්විය යුතු වේ.",
    outputLabel: "Corrected Sinhala Output (Subject-Verb Agreement Fixed)",
    output:
      "ජනාධිපතිවරයා ඊයේ පැවති උත්සවයේදී නව ආර්ථික ප්‍රතිපත්තිය ප්‍රකාශ කළේය. රටේ සංවර්ධනය සඳහා සියලු ජනතාව එක්විය යුතු වේ.",
    annotations: [
      "Subject-Verb Agreement: 'ජනාධිපතිවරයා' (honorific) → 'ප්‍රකාශ කළේය' (corrected from feminine 'කළාය')",
      "Morphological Case Alignment: 100% syntactic harmony validated",
    ],
    metrics: [
      { label: "Confidence", val: "99.4%" },
      { label: "Latency", val: "280ms" },
      { label: "Syntax Harmonized", val: "Yes" },
    ],
  },
  headlines: {
    tool: "headlines",
    title: "Journalistic Headline Generator",
    badge: "LoRA v17 • Newsroom Editorial",
    inputLabel: "Source Article Body (Economics / Trade)",
    input:
      "ශ්‍රී ලංකා මහ බැංකුව විසින් ප්‍රකාශයට පත් කරන ලද නවතම වාර්තාවට අනුව මෙරට උද්ධමනය තනි අංකයක මට්ටමකට පහත වැටී ඇති අතර විදේශ විනිමය සංචිතය ඩොලර් බිලියන 6 ඉක්මවා වර්ධනය වී තිබේ.",
    outputLabel: "Targeted Journalistic Headlines",
    output: [
      "උද්ධමනය තනි අංකයට පහත බසී: විදේශ සංචිත ඩොලර් බිලියන 6 සීමාව ඉක්මවයි",
      "ශ්‍රී ලංකා ආර්ථිකයේ ප්‍රබල පිබිදීමක්: මහ බැංකු වාර්තාවෙන් හෙළිවන නවතම තතු",
      "විදේශ විනිමය සංචිත වාර්තාගත ලෙස ඉහළට — උද්ධමනය පාලනය වූ හැටි",
    ],
    annotations: [
      "Optimized for Sinhala Newspaper front-pages & breaking news tickers",
      "3 Distinct Angles: Direct Impact, Analytical, and Narrative Hook",
    ],
    metrics: [
      { label: "Click Potential", val: "High" },
      { label: "ROUGE-L Score", val: "0.89" },
      { label: "Editorial Register", val: "News/Formal" },
    ],
  },
  rewriter: {
    tool: "rewriter",
    title: "5-Tone Style & Register Rewriter",
    badge: "LoRA v07 • Stylistic Transfer",
    inputLabel: "Neutral News Wire Input",
    input:
      "කෘෂිකර්ම දෙපාර්තමේන්තුව විසින් නවීන තාක්ෂණය භාවිත කරමින් වී වගාවේ අස්වැන්න ඉහළ නැංවීමේ නව වැඩසටහනක් ආරම්භ කර ඇත.",
    outputLabel: "Rewritten in 'Analytical & Investigative' Tone",
    output:
      "දේශීය වී වගාවේ ඵලදායිතාව ඉහළ නැංවීම ඉලක්ක කරගනිමින් කෘෂිකර්ම දෙපාර්තමේන්තුව නවීන තාක්ෂණික ප්‍රවේශයක් හඳුන්වා දීමට පියවර ගෙන තිබේ. මෙම උපායමාර්ගික වැඩසටහන මඟින් ගොවි ප්‍රජාවගේ ආර්ථික ස්ථාවරත්වය තහවුරු කිරීමට අපේක්ෂා කෙරේ.",
    annotations: [
      "Selected Tone: Analytical & Persuasive (විශ්ලේෂණාත්මක)",
      "Vocabulary expanded with formal domain nomenclature and strategic tone",
    ],
    metrics: [
      { label: "Tone Accuracy", val: "98.2%" },
      { label: "Lexical Variety", val: "+42%" },
      { label: "Register", val: "Formal Broadcaster" },
    ],
  },
  summarizer: {
    tool: "summarizer",
    title: "Abstractive News Summarizer",
    badge: "LoRA v04 • Condensation Engine",
    inputLabel: "Full News Article (680 words)",
    input:
      "කොළඹ වරාය නගරයේ ඉදිකෙරෙන නව ජාත්‍යන්තර මූල්‍ය මධ්‍යස්ථානය සඳහා විදේශීය ආයෝජකයින් රැසක් සිය කැමැත්ත පළ කර තිබේ. දකුණු ආසියානු කලාපයේ ප්‍රමුඛතම මූල්‍ය හා වෙළඳ මධ්‍යස්ථානයක් බවට පත්වීමේ අරමුණින් ක්‍රියාත්මක වන මෙම ව්‍යාපෘතිය මඟින් ඉදිරි වසර පහ තුළ සෘජු විදේශ ආයෝජන ඩොලර් බිලියන 3ක් රට තුළට ගලා ඒමට නියමිත බව වරාය නගර ආර්ථික කොමිෂන් සභාව පවසයි.",
    outputLabel: "Abstractive Executive Summary (Key Takeaways)",
    output: [
      "• කොළඹ වරාය නගරයේ නව ජාත්‍යන්තර මූල්‍ය මධ්‍යස්ථානයට විදේශ ආයෝජක ප්‍රතිචාර ඉහළ යයි.",
      "• ඉදිරි වසර 5 තුළ ඩොලර් බිලියන 3ක සෘජු විදේශ ආයෝජන (FDI) ගලා ඒමේ ඉලක්කයක්.",
      "• දකුණු ආසියාවේ ප්‍රධාන ආර්ථික හා මූල්‍ය කේන්ද්‍රස්ථානයක් ලෙස ස්ථාපිත කිරීමට සැලසුම්.",
    ],
    annotations: [
      "Length Reduction: 74% compression with 100% entity and fact retention",
      "Executive structured bullet view ready for editorial syndication",
    ],
    metrics: [
      { label: "Compression", val: "74%" },
      { label: "Entity Recall", val: "100%" },
      { label: "Format", val: "Bullet / Executive" },
    ],
  },
};

export default function Hero() {
  const [activeTab, setActiveTab] = useState<ToolType>("grammar");
  const [copied, setCopied] = useState(false);

  const currentSample = SAMPLES[activeTab];

  const handleCopy = () => {
    const textToCopy = Array.isArray(currentSample.output)
      ? currentSample.output.join("\n")
      : currentSample.output;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="hero" className="relative pt-24 pb-16 sm:pt-36 sm:pb-24 md:pt-44 md:pb-36 px-4 sm:px-6 lg:px-12 max-w-[1560px] mx-auto overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] sm:w-[500px] md:w-[700px] h-[300px] sm:h-[400px] md:h-[500px] bg-gradient-to-br from-[#cd191a]/10 via-[#ff4b2b]/5 to-transparent rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Status Pill */}
      <div className="flex justify-center mb-6 sm:mb-8">
        <div className="inline-flex items-center gap-1.5 sm:gap-2.5 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full bg-white border border-[#D9D7D0] shadow-sm hover:border-[#cd191a]/40 transition-all duration-300">
          <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#cd191a] animate-pulse shrink-0" />
          <span className="text-[10px] sm:text-xs font-semibold text-[#1B1B1B] tracking-wide uppercase">
            SinLLaMA 2.4 Research
          </span>
          <span className="text-xs text-[#8C8880]">•</span>
          <span className="text-[10px] sm:text-xs font-medium text-[#8C8880]">Specialized Sinhala AI</span>
        </div>
      </div>

      {/* Main Architectural Headline */}
      <div className="text-center max-w-5xl mx-auto mb-8 sm:mb-10">
        <h1 className="font-display text-3xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-[84px] font-bold text-[#181818] tracking-tight leading-[1.08] sm:leading-[1.05] mb-4 sm:mb-6 text-balance">
          The Intelligent Foundation for <br className="hidden sm:inline" />
          <span className="italic font-normal font-display text-[#cd191a]">Sinhala Journalism</span> and Writing
        </h1>
        <p className="text-xs sm:text-base md:text-lg lg:text-xl text-[#615e58] max-w-3xl mx-auto font-normal leading-relaxed text-balance px-2">
          Empowering Sri Lankan newsrooms, editors, and writers with domain-adapted LLMs.
          Fine-tuned on authentic journalistic corpora with specialized LoRA adapters for grammar, headlines, style, and summarization.
        </p>
      </div>

      {/* Call to Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-12 sm:mb-20 px-2">
        <a
          href="http://localhost:5173"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#181818] hover:bg-[#cd191a] text-white px-5 sm:px-8 py-3 sm:py-4 rounded-full font-bold text-xs sm:text-sm uppercase tracking-wider shadow-xl hover:shadow-[#cd191a]/30 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#ff8a8a]" />
          <span>Launch Web App Playground</span>
          <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </a>

        <a
          href="#playground-simulator"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white hover:bg-[#F0EFEB] text-[#1B1B1B] border border-[#D9D7D0] px-5 sm:px-7 py-3 sm:py-4 rounded-full font-bold text-xs sm:text-sm uppercase tracking-wider transition-all duration-200 shadow-sm"
        >
          <span>Try Interactive Demo</span>
        </a>
      </div>

      {/* Interactive Hero Stage (2-Pane Workspace Mockup) */}
      <div className="w-full max-w-[1380px] mx-auto bg-gradient-to-b from-[#F0EFEB] to-[#E9E8E4] p-3 sm:p-5 md:p-7 rounded-2xl sm:rounded-[44px] shadow-[0_24px_70px_rgba(0,0,0,0.08)] border border-[#D9D7D0]/80 relative overflow-hidden">
        {/* Top Window Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-[#D9D7D0]/60">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#ef4444]/80" />
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#eab308]/80" />
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-[#22c55e]/80" />
            <span className="ml-2 sm:ml-3 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[#8C8880] flex items-center gap-1">
              <Cpu className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#cd191a]" />
              <span>Studio Workspace</span>
            </span>
          </div>

          {/* Tool Switcher Tabs */}
          <div className="flex items-center gap-1 bg-white/70 p-1 rounded-full border border-[#D9D7D0] shadow-inner overflow-x-auto max-w-full">
            <button
              onClick={() => setActiveTab("grammar")}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 shrink-0 ${
                activeTab === "grammar"
                  ? "bg-[#181818] text-white shadow-md"
                  : "text-[#615e58] hover:text-[#181818] hover:bg-white/80"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Grammar</span>
            </button>
            <button
              onClick={() => setActiveTab("headlines")}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 shrink-0 ${
                activeTab === "headlines"
                  ? "bg-[#181818] text-white shadow-md"
                  : "text-[#615e58] hover:text-[#181818] hover:bg-white/80"
              }`}
            >
              <Heading className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Headlines</span>
            </button>
            <button
              onClick={() => setActiveTab("rewriter")}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 shrink-0 ${
                activeTab === "rewriter"
                  ? "bg-[#181818] text-white shadow-md"
                  : "text-[#615e58] hover:text-[#181818] hover:bg-white/80"
              }`}
            >
              <Wand2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>5-Tone Style</span>
            </button>
            <button
              onClick={() => setActiveTab("summarizer")}
              className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 shrink-0 ${
                activeTab === "summarizer"
                  ? "bg-[#181818] text-white shadow-md"
                  : "text-[#615e58] hover:text-[#181818] hover:bg-white/80"
              }`}
            >
              <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Summarizer</span>
            </button>
          </div>
        </div>

        {/* Live 2-Pane Editor Mockup */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
          {/* Left Pane: Input Editor */}
          <div className="bg-[#FFFDF8] rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm border border-[#D9D7D0]/60 flex flex-col justify-between min-h-[280px] sm:min-h-[340px]">
            <div>
              <div className="flex items-center justify-between pb-2.5 sm:pb-3 mb-2.5 sm:mb-3 border-b border-[#F0EFEB]">
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#8C8880]">
                  {currentSample.inputLabel}
                </span>
                <span className="text-[10px] sm:text-[11px] font-medium text-[#cd191a] bg-[#cd191a]/10 px-2 py-0.5 rounded-full">
                  Input Stream
                </span>
              </div>
              <p className="font-sinhala text-sm sm:text-base md:text-lg text-[#1B1B1B] leading-relaxed select-text">
                {currentSample.input}
              </p>
            </div>

            <div className="pt-3 sm:pt-4 mt-4 sm:mt-6 border-t border-[#F0EFEB] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-[#8C8880]">
                <span>Unicode UTF-8</span>
                <span>•</span>
                <span>Sinhala (si)</span>
              </div>
              <div className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-[#cd191a] uppercase tracking-wider">
                <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Inference Active</span>
              </div>
            </div>
          </div>

          {/* Right Pane: AI Inference Results */}
          <div className="bg-gradient-to-br from-[#181818] to-[#121212] text-white rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-xl border border-white/10 flex flex-col justify-between min-h-[280px] sm:min-h-[340px] relative overflow-hidden">
            {/* Ambient glow in card */}
            <div className="absolute top-0 right-0 w-36 sm:w-48 h-36 sm:h-48 bg-[#cd191a]/20 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 sm:pb-3 mb-3 sm:mb-4 border-b border-white/10">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/80">
                    {currentSample.outputLabel}
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-bold text-white bg-[#cd191a] px-1.5 sm:px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {currentSample.badge}
                  </span>
                </div>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[10px] sm:text-xs text-white/60 hover:text-white bg-white/10 hover:bg-white/20 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>

              {/* Output Content */}
              {Array.isArray(currentSample.output) ? (
                <div className="space-y-2">
                  {currentSample.output.map((line, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 sm:p-3 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 hover:border-[#cd191a]/50 transition-colors font-sinhala text-xs sm:text-sm md:text-base text-white/95 leading-relaxed"
                    >
                      {line}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 sm:p-4 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 font-sinhala text-xs sm:text-sm md:text-base text-white/95 leading-relaxed">
                  {currentSample.output}
                </div>
              )}

              {/* Annotations */}
              {currentSample.annotations && (
                <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-white/10 space-y-1">
                  {currentSample.annotations.map((ann, i) => (
                    <p key={i} className="text-[11px] sm:text-xs text-white/60 flex items-start gap-1.5">
                      <span className="text-[#cd191a] font-bold">✓</span>
                      <span>{ann}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Metrics Bar */}
            <div className="pt-3 sm:pt-4 mt-4 sm:mt-6 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-3 sm:gap-4">
                {currentSample.metrics?.map((m, idx) => (
                  <div key={idx} className="flex flex-col">
                    <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-white/50">{m.label}</span>
                    <span className="text-[11px] sm:text-xs font-bold text-white">{m.val}</span>
                  </div>
                ))}
              </div>

              <a
                href="http://localhost:5173"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold text-[#ff8a8a] hover:text-white uppercase tracking-wider transition-colors"
              >
                <span>Full Workspace</span>
                <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
