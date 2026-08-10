"use client";

import React, { useState } from "react";
import {
  CheckCircle,
  Wand2,
  RefreshCw,
  FileCode2,
  Flame,
} from "lucide-react";

export default function VisualCollage() {
  const [activeTone, setActiveTone] = useState<string>("analytical");
  const [syncState, setSyncState] = useState<boolean>(true);

  return (
    <section
      id="capabilities"
      className="relative min-h-[850px] lg:min-h-[950px] w-full max-w-[1560px] mx-auto overflow-hidden bg-[#FAF9F5] py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-12 flex flex-col justify-center items-center"
    >
      {/* Background Central Atmospheric Anchor */}
      <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none select-none opacity-100 z-0">
        <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] font-bold text-[#cd191a] mb-2 sm:mb-4">
          Core NLP Capabilities
        </span>
        <h2 className="font-display text-4xl sm:text-6xl md:text-8xl lg:text-[110px] font-bold text-[#181818]/10 text-center tracking-tighter leading-[0.95] max-w-5xl">
          Linguistic <br /> Intelligence
        </h2>
      </div>

      {/* Floating Collage Grid Layout */}
      <div className="relative z-10 w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto my-auto">
        {/* Card 1: Syntactic & Morphological Analysis (Top-Left) */}
        <div className="bg-white/80 backdrop-blur-xl border border-[#D9D7D0] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[0_16px_40px_rgba(0,0,0,0.06)] hover:border-[#cd191a]/40 transition-all duration-300 group">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#cd191a]/10 flex items-center justify-center text-[#cd191a]">
                <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#181818]">
                Syntax &amp; Agreement
              </span>
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded-full">
              Real-Time
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-[#8C8880] mb-3">
            Detects inflectional mismatches, gender-number agreement, and case markers:
          </p>

          <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F0EFEB] border border-[#D9D7D0]/60 space-y-2 mb-3 sm:mb-4">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs">
              <span className="px-1.5 sm:px-2 py-0.5 rounded bg-rose-500/15 text-rose-700 font-semibold font-sinhala line-through text-xs sm:text-sm">
                ප්‍රකාශ කළාය
              </span>
              <span className="text-[#8C8880]">→</span>
              <span className="px-1.5 sm:px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 font-bold font-sinhala text-xs sm:text-sm">
                ප්‍රකාශ කළේය
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[#615e58]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#cd191a]" />
              <span>Subject-Verb Gender/Honorific Harmony</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] sm:text-xs pt-2 border-t border-[#D9D7D0]/40">
            <span className="text-[#8C8880] font-medium">Adapter: grammar_v13</span>
            <span className="font-bold text-[#cd191a]">99.4% Precision</span>
          </div>
        </div>

        {/* Card 2: 5-Tone Style Engine */}
        <div className="bg-[#181818] text-white rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-white/10 flex flex-col justify-between group hover:border-[#cd191a]/60 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-28 sm:w-32 h-28 sm:h-32 bg-gradient-to-br from-[#cd191a]/30 to-transparent rounded-full blur-xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-tr from-[#cd191a] to-[#ff4b2b] flex items-center justify-center text-white shadow-md">
                  <Wand2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-white">
                  5-Tone Style Engine
                </span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-white/10 text-[#ff8a8a] px-2 py-0.5 rounded-full">
                LoRA v07
              </span>
            </div>

            <p className="text-[11px] sm:text-xs text-white/70 mb-3">
              Switch registers dynamically for print, digital, broadcast, or social:
            </p>

            {/* Tone Selector Pills */}
            <div className="flex flex-wrap gap-1 sm:gap-1.5 mb-3 sm:mb-4">
              {[
                { id: "formal", label: "Formal (සාම්ප්‍රදායික)" },
                { id: "analytical", label: "Analytical (විශ්ලේෂණාත්මක)" },
                { id: "sensational", label: "Sensational (ආකර්ෂණීය)" },
                { id: "casual", label: "Casual (සරල)" },
              ].map((tone) => (
                <button
                  key={tone.id}
                  onClick={() => setActiveTone(tone.id)}
                  className={`text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full font-medium transition-all duration-200 ${
                    activeTone === tone.id
                      ? "bg-[#cd191a] text-white shadow-md font-bold"
                      : "bg-white/10 text-white/80 hover:bg-white/20"
                  }`}
                >
                  {tone.label}
                </button>
              ))}
            </div>

            <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-white/5 border border-white/10 font-sinhala text-[11px] sm:text-xs text-white/90 leading-relaxed">
              {activeTone === "formal" &&
                "රජය විසින් ආර්ථික ස්ථායිකරණය උදෙසා ගනු ලැබූ උපායමාර්ගික ක්‍රියාමාර්ග පිළිබඳ පුළුල් වාර්තාවක් නිකුත් කෙරේ."}
              {activeTone === "analytical" &&
                "වෙළඳපොළ දත්ත හා මූල්‍ය දර්ශක ගැඹුරින් විශ්ලේෂණය කරමින් නව ආර්ථික ප්‍රතිපත්තියේ දිගුකාලීන බලපෑම ඇගයීමට ලක් කෙරේ."}
              {activeTone === "sensational" &&
                "ආර්ථිකයේ පෙරළිකාර ජයග්‍රහණයක්! මහ බැංකු වාර්තාවෙන් හෙළිවන සංචිතවල දැවැන්ත පිම්ම මෙන්න!"}
              {activeTone === "casual" &&
                "රටේ ආර්ථිකය ආයෙත් වේගයෙන් දියුණු වෙන විදිහ ගැන අලුත්ම තොරතුරු ටිකක් මෙන්න."}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] sm:text-xs pt-3 mt-3 sm:mt-4 border-t border-white/10">
            <span className="text-white/50">Register Preservation</span>
            <span className="font-bold text-[#ff8a8a]">100% Lexical Consistency</span>
          </div>
        </div>

        {/* Card 3: Legacy Newsroom Typography Bridge */}
        <div className="bg-white/80 backdrop-blur-xl border border-[#D9D7D0] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[0_16px_40px_rgba(0,0,0,0.06)] hover:border-[#cd191a]/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#cd191a]/10 flex items-center justify-center text-[#cd191a]">
                <FileCode2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#181818]">
                Legacy FM/UBIN Decoder
              </span>
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-amber-500/10 text-amber-700 px-2 py-0.5 rounded-full">
              Newsroom Heritage
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-[#8C8880] mb-3">
            Native support for legacy ASCII-encoded Sri Lankan print typesetting fonts:
          </p>

          <div className="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F0EFEB] border border-[#D9D7D0]/60 space-y-2 mb-3 sm:mb-4">
            <div className="text-xs">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-[#8C8880] block mb-1">
                Legacy ASCII Newsroom Input:
              </span>
              <span className="font-mono text-[11px] sm:text-xs text-[#181818] bg-white px-2 py-1 rounded border border-[#D9D7D0] block truncate">
                fuys Tnf.a isxy, jdlHh we;=&lt;a lrkak&#39;&#39;&#39;
              </span>
            </div>
            <div className="text-xs pt-1">
              <span className="text-[9px] sm:text-[10px] uppercase font-bold text-[#cd191a] block mb-1">
                Converted Unicode Sinhala:
              </span>
              <span className="font-sinhala text-[11px] sm:text-xs font-bold text-[#181818] bg-white px-2 py-1 rounded border border-[#D9D7D0] block truncate">
                මෙහි ඔබගේ සිංහල වාක්‍යය ඇතුළත් කරන්න...
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] sm:text-xs pt-2 border-t border-[#D9D7D0]/40">
            <span className="text-[#8C8880] font-medium">No gibberish flashes</span>
            <span className="font-bold text-[#cd191a]">Zero Data Loss</span>
          </div>
        </div>

        {/* Card 4: Multi-Surface Ecosystem Sync */}
        <div className="bg-white/80 backdrop-blur-xl border border-[#D9D7D0] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[0_16px_40px_rgba(0,0,0,0.06)] hover:border-[#cd191a]/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-[#cd191a] to-[#ff4b2b] flex items-center justify-center text-white shadow-md">
                <RefreshCw className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" style={{ animationDuration: "8s" }} />
              </div>
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#181818]">
                Multi-Surface Sync
              </span>
            </div>
            <button
              onClick={() => setSyncState(!syncState)}
              className={`w-8 sm:w-9 h-4 sm:h-5 rounded-full p-0.5 transition-colors duration-200 flex items-center ${
                syncState ? "bg-[#181818]" : "bg-gray-300"
              }`}
            >
              <div
                className={`w-3.5 sm:w-4 h-3.5 sm:h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                  syncState ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <p className="text-[11px] sm:text-xs text-[#8C8880] mb-3">
            Write seamlessly across your favorite journalistic environments:
          </p>

          <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
            <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-[#F0EFEB] border border-[#D9D7D0]/50 text-[11px] sm:text-xs">
              <span className="font-semibold text-[#181818]">1. SinAi Web App</span>
              <span className="text-[9px] sm:text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 sm:px-2 py-0.5 rounded-full">
                Workspace
              </span>
            </div>
            <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-[#F0EFEB] border border-[#D9D7D0]/50 text-[11px] sm:text-xs">
              <span className="font-semibold text-[#181818]">2. Chrome Extension</span>
              <span className="text-[9px] sm:text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 sm:px-2 py-0.5 rounded-full">
                Browser Native
              </span>
            </div>
            <div className="flex items-center justify-between p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-[#F0EFEB] border border-[#D9D7D0]/50 text-[11px] sm:text-xs">
              <span className="font-semibold text-[#181818]">3. Google Docs Add-on</span>
              <span className="text-[9px] sm:text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 sm:px-2 py-0.5 rounded-full">
                Newsroom Docs
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] sm:text-xs pt-2 border-t border-[#D9D7D0]/40">
            <span className="text-[#8C8880]">Client Interfaces</span>
            <span className="font-bold text-[#cd191a]">3 Unified Surfaces</span>
          </div>
        </div>

        {/* Card 5: Headline Generator & Click Crafter */}
        <div className="bg-white/80 backdrop-blur-xl border border-[#D9D7D0] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[0_16px_40px_rgba(0,0,0,0.06)] hover:border-[#cd191a]/40 transition-all duration-300">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#cd191a]/10 flex items-center justify-center text-[#cd191a]">
                <Flame className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </div>
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#181818]">
                Editorial Headlines
              </span>
            </div>
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-widest bg-purple-500/10 text-purple-700 px-2 py-0.5 rounded-full">
              LoRA v17
            </span>
          </div>

          <p className="text-[11px] sm:text-xs text-[#8C8880] mb-3">
            Targeted category angles calibrated for Sri Lankan news readership:
          </p>

          <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-[#F0EFEB] border border-[#D9D7D0]/60 space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
            <div className="p-2 bg-white rounded-lg border border-[#D9D7D0] font-sinhala text-[11px] sm:text-xs font-bold text-[#181818] shadow-sm">
              📰 උද්ධමනය තනි අංකයට පහත බසී: විදේශ සංචිත වාර්තාගත ලෙස ඉහළට
            </div>
            <div className="p-2 bg-white rounded-lg border border-[#D9D7D0] font-sinhala text-[11px] sm:text-xs text-[#615e58]">
              🔍 ශ්‍රී ලංකා ආර්ථිකයේ ප්‍රබල පිබිදීමක්: මහ බැංකු වාර්තාවෙන් හෙළිවන තතු
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] sm:text-xs pt-2 border-t border-[#D9D7D0]/40">
            <span className="text-[#8C8880]">Editorial Angle</span>
            <span className="font-bold text-[#cd191a]">Front-Page Calibrated</span>
          </div>
        </div>

        {/* Card 6: Verified Newsroom Endorsement */}
        <div className="bg-gradient-to-br from-[#FFFDF8] to-[#F4F3EF] border border-[#D9D7D0] rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-[0_16px_40px_rgba(0,0,0,0.06)] hover:border-[#cd191a]/40 transition-all duration-300 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#cd191a]">
                Newsroom Verified
              </span>
              <span className="flex text-amber-500 text-xs">★★★★★</span>
            </div>

            <p className="font-display text-xs sm:text-sm md:text-base text-[#181818] italic leading-relaxed mb-3 sm:mb-4">
              &ldquo;SinAi is the first AI tool that genuinely understands the syntactic complexity of formal Sinhala grammar and news registers.&rdquo;
            </p>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 pt-2.5 sm:pt-3 border-t border-[#D9D7D0]/50">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#cd191a] to-[#ab1112] text-white flex items-center justify-center font-bold text-xs sm:text-sm font-display shadow-md shrink-0">
              KS
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#181818]">Kavinda Senanayake</span>
              <span className="text-[10px] sm:text-[11px] text-[#8C8880]">Chief Sub-Editor, Digital Media</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
