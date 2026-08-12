"use client";

import React, { useState } from "react";
import {
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Heading,
  Wand2,
  FileText,
  Play,
  RotateCcw,
  Copy,
  Check,
  Zap,
} from "lucide-react";

type ActiveTool = "grammar" | "headlines" | "rewriter" | "summarizer";

interface PresetSample {
  category: string;
  label: string;
  text: string;
}

const PRESETS: Record<ActiveTool, PresetSample[]> = {
  grammar: [
    {
      category: "Politics",
      label: "Subject-Verb Agreement",
      text: "ජනාධිපතිවරයා ඊයේ පැවති සමුළුවේදී නව ජාතික ප්‍රතිපත්තිය ප්‍රකාශ කළාය. සියලු මන්ත්‍රීවරුන් ඊට සහභාගී විය.",
    },
    {
      category: "Economics",
      label: "Case Marker Mismatch",
      text: "ශ්‍රී ලංකා මහ බැංකුව විසින් නව ණය ප්‍රතිපත්තියක් හඳුන්වා දීමට තීරණය කළේය. එමගින් ආර්ථිකය ස්ථාවරත්වයක් කරා ළඟා විය හැකිය.",
    },
    {
      category: "Journalism",
      label: "Inflectional Typo",
      text: "ප්‍රවෘත්ති වාර්තාකරුවන් එම සිදුවීම පිළිබඳව තොරතුරු සෙවීමට පටන් ගත්තේය.",
    },
  ],
  headlines: [
    {
      category: "Economics",
      label: "Central Bank Forex Growth",
      text: "ශ්‍රී ලංකා මහ බැංකුවේ නවතම මූල්‍ය වාර්තාවට අනුව මෙරට නිල සංචිත වත්කම් ප්‍රමාණය ඇමෙරිකානු ඩොලර් බිලියන 6 ඉක්මවා වර්ධනය වී ඇති බව නිවේදනය කෙරේ.",
    },
    {
      category: "Technology",
      label: "AI Research Center Opening",
      text: "කොළඹ විශ්වවිද්‍යාලය සහ තොරතුරු තාක්ෂණ ආයතන එක්ව ශ්‍රී ලංකාවේ ප්‍රථම ජාතික කෘත්‍රිම බුද්ධි පර්යේෂණ මධ්‍යස්ථානය විවෘත කිරීමට සියලු කටයුතු සූදානම් කර ඇත.",
    },
  ],
  rewriter: [
    {
      category: "General",
      label: "News Wire Statement",
      text: "කාලගුණ විද්‍යා දෙපාර්තමේන්තුව පවසන්නේ ඉදිරි පැය 24 තුළ දිවයිනේ ප්‍රදේශ කිහිපයකට තද වැසි ඇතිවිය හැකි බවයි.",
    },
    {
      category: "Business",
      label: "Corporate Launch",
      text: "නව සමාගම විසින් පරිගණක මෘදුකාංග ක්ෂේත්‍රයේ නවතම නිෂ්පාදනයක් වෙළඳපොළට නිකුත් කරනු ලැබීය.",
    },
  ],
  summarizer: [
    {
      category: "Environment",
      label: "Climate Action Report",
      text: "ශ්‍රී ලංකාවේ පුනර්ජනනීය බලශක්ති ව්‍යාපෘති කඩිනම් කිරීම සඳහා රජය නව ජාතික සැලැස්මක් ප්‍රකාශයට පත් කර ඇත. සූර්ය හා සුළං බලශක්තිය මඟින් ජාතික විදුලිබල පද්ධතියට මෙගාවොට් 1000ක් එක් කිරීමට සැලසුම් කර ඇති අතර, එමගින් පරිසර දූෂණය අවම කර ගනිමින් ඉන්ධන ආනයන වියදම් විශාල ලෙස ඉතිරි කර ගැනීමට හැකි වනු ඇතැයි බලශක්ති අමාත්‍යාංශය අවධාරණය කරයි.",
    },
  ],
};

export default function InteractivePlayground() {
  const [tool, setTool] = useState<ActiveTool>("grammar");
  const [inputText, setInputText] = useState<string>(PRESETS.grammar[0].text);
  const [selectedTone, setSelectedTone] = useState<string>("analytical");
  const [summaryView, setSummaryView] = useState<"bullets" | "paragraph">("bullets");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [resultOutput, setResultOutput] = useState<string | string[] | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleToolChange = (newTool: ActiveTool) => {
    setTool(newTool);
    setInputText(PRESETS[newTool][0].text);
    setResultOutput(null);
  };

  const handlePresetSelect = (preset: PresetSample) => {
    setInputText(preset.text);
    setResultOutput(null);
  };

  const handleRunInference = () => {
    setIsLoading(true);
    setResultOutput(null);

    setTimeout(() => {
      if (tool === "grammar") {
        setResultOutput(
          inputText
            .replace("ප්‍රකාශ කළාය", "ප්‍රකාශ කළේය")
            .replace("සහභාගී විය", "සහභාගී වූහ")
            .replace("පටන් ගත්තේය", "පටන් ගත්හ")
        );
      } else if (tool === "headlines") {
        setResultOutput([
          "🔴 නිල සංචිත ඩොලර් බිලියන 6 සීමාව ඉක්මවයි: මහ බැංකු වාර්තාවෙන් නවතම තතු",
          "📌 ශ්‍රී ලංකාවේ ආර්ථික ස්ථාවරත්වය තහවුරු වෙයි — සංචිතවල වාර්තාගත වර්ධනයක්",
          "📈 විදේශ විනිමය සංචිත ඉහළට: ආර්ථික පිබිදීම ගැන නිල ප්‍රකාශය මෙන්න",
        ]);
      } else if (tool === "rewriter") {
        if (selectedTone === "formal") {
          setResultOutput(
            "කාලගුණ විද්‍යා දෙපාර්තමේන්තුව විසින් නිකුත් කරන ලද නිල නිවේදනයට අනුව ඉදිරි පැය විසිහතරක කාලසීමාව තුළ දිවයිනේ දිස්ත්‍රික්ක කිහිපයකට සැලකිය යුතු වර්ෂාපතනයක් අපේක්ෂා කෙරේ."
          );
        } else if (selectedTone === "sensational") {
          setResultOutput(
            "අවධානයෙන් ඉන්න! ඉදිරි පැය 24 තුළ ප්‍රදේශ රැසකට ඇදහැලෙන මහා වැසි ගැන කාලගුණයෙන් හදිසි අනතුරු ඇඟවීමක්!"
          );
        } else {
          setResultOutput(
            "වායුගෝලීය තත්ත්වයන් ගැඹුරින් විශ්ලේෂණය කරමින් කාලගුණ විද්‍යා දෙපාර්තමේන්තුව පෙන්වා දෙන්නේ ඉදිරි පැය 24 තුළ තද වැසි ඇතිවීමේ ඉහළ සම්භාවිතාවක් පවතින බවයි."
          );
        }
      } else if (tool === "summarizer") {
        if (summaryView === "bullets") {
          setResultOutput([
            "• පුනර්ජනනීය බලශක්තිය කඩිනම් කිරීමට රජයෙන් නව ජාතික සැලැස්මක් ප්‍රකාශයට පත් කෙරේ.",
            "• සූර්ය හා සුළං බලයෙන් ජාතික විදුලි පද්ධතියට මෙගාවොට් 1000ක් එක් කිරීමේ ඉලක්කයක්.",
            "• පරිසර දූෂණය පාලනය කරමින් ඉන්ධන ආනයන වියදම් සැලකිය යුතු ලෙස ඉතිරි කිරීමට පියවර.",
          ]);
        } else {
          setResultOutput(
            "පුනර්ජනනීය බලශක්ති ව්‍යාපෘති කඩිනම් කිරීම සඳහා රජය නව සැලැස්මක් හඳුන්වා දී ඇති අතර සූර්ය හා සුළං බලයෙන් මෙගාවොට් 1000ක් ජාතික පද්ධතියට එක් කිරීම මඟින් ඉන්ධන වියදම් ඉතිරි කර ගැනීමට අපේක්ෂා කෙරේ."
          );
        }
      }
      setIsLoading(false);
    }, 600);
  };

  const handleCopy = () => {
    if (!resultOutput) return;
    const textToCopy = Array.isArray(resultOutput) ? resultOutput.join("\n") : resultOutput;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section
      id="playground-simulator"
      className="py-16 sm:py-24 md:py-32 px-4 sm:px-6 lg:px-12 max-w-[1560px] mx-auto bg-[#FAF9F5] border-t border-[#D9D7D0]/60"
    >
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-full bg-[#cd191a]/10 text-[#cd191a] text-[10px] sm:text-xs font-bold uppercase tracking-widest mb-3 sm:mb-4">
          <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span>Interactive Browser Workspace</span>
        </div>
        <h2 className="font-display text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#181818] tracking-tight leading-tight mb-3 sm:mb-4">
          Test SinAi in real time.
        </h2>
        <p className="text-xs sm:text-base md:text-lg text-[#615e58] leading-relaxed">
          Experience our domain-adapted Sinhala AI models directly below. Select any preset or type your own text, then open the full workspace when ready.
        </p>
      </div>

      {/* Simulator Container */}
      <div className="w-full max-w-5xl mx-auto bg-white rounded-2xl sm:rounded-[36px] shadow-2xl border border-[#D9D7D0] overflow-hidden">
        {/* Simulator Header Tabs */}
        <div className="bg-[#181818] p-3 sm:p-5 flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-white/10">
          {/* Tool Navigation */}
          <div className="flex items-center gap-1 bg-white/10 p-1 rounded-full overflow-x-auto max-w-full">
            <button
              onClick={() => handleToolChange("grammar")}
              className={`flex items-center gap-1 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 shrink-0 ${
                tool === "grammar"
                  ? "bg-[#cd191a] text-white shadow-md"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Grammar</span>
            </button>
            <button
              onClick={() => handleToolChange("headlines")}
              className={`flex items-center gap-1 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 shrink-0 ${
                tool === "headlines"
                  ? "bg-[#cd191a] text-white shadow-md"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <Heading className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Headlines</span>
            </button>
            <button
              onClick={() => handleToolChange("rewriter")}
              className={`flex items-center gap-1 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 shrink-0 ${
                tool === "rewriter"
                  ? "bg-[#cd191a] text-white shadow-md"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <Wand2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>5-Tone Style</span>
            </button>
            <button
              onClick={() => handleToolChange("summarizer")}
              className={`flex items-center gap-1 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-bold transition-all duration-200 shrink-0 ${
                tool === "summarizer"
                  ? "bg-[#cd191a] text-white shadow-md"
                  : "text-white/70 hover:text-white hover:bg-white/10"
              }`}
            >
              <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              <span>Summarizer</span>
            </button>
          </div>

          {/* Right Action: Launch Full Web App */}
          <a
            href="https://chat.sin-ai.app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white bg-white/10 hover:bg-[#cd191a] px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-all duration-200"
          >
            <span>Try SinAi</span>
            <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          </a>
        </div>

        {/* Simulator Toolbar & Preset Chips */}
        <div className="bg-[#FAF9F5] px-4 sm:px-6 py-3 sm:py-4 border-b border-[#D9D7D0]/60 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-1 max-w-full">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#8C8880] shrink-0">
              Presets:
            </span>
            {PRESETS[tool].map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handlePresetSelect(preset)}
                className="text-[11px] sm:text-xs bg-white hover:bg-[#F0EFEB] text-[#181818] border border-[#D9D7D0] px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full font-medium transition-colors shrink-0"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Contextual Sub-Options */}
          {tool === "rewriter" && (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-[10px] sm:text-xs text-[#8C8880] font-bold uppercase">Tone:</span>
              {["formal", "analytical", "sensational"].map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedTone(t)}
                  className={`text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 rounded-full capitalize font-semibold transition-colors ${
                    selectedTone === t
                      ? "bg-[#181818] text-white"
                      : "bg-white text-[#615e58] border border-[#D9D7D0]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}

          {tool === "summarizer" && (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <span className="text-[10px] sm:text-xs text-[#8C8880] font-bold uppercase">Format:</span>
              {(["bullets", "paragraph"] as const).map((view) => (
                <button
                  key={view}
                  onClick={() => setSummaryView(view)}
                  className={`text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 rounded-full capitalize font-semibold transition-colors ${
                    summaryView === view
                      ? "bg-[#181818] text-white"
                      : "bg-white text-[#615e58] border border-[#D9D7D0]"
                  }`}
                >
                  {view}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Input Text Area & Actions */}
        <div className="p-4 sm:p-6 md:p-8">
          <div className="mb-4 sm:mb-6">
            <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#8C8880] mb-1.5 sm:mb-2">
              Input Sinhala Text (Unicode UTF-8)
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              rows={4}
              className="w-full font-sinhala text-sm sm:text-base md:text-lg text-[#181818] p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-[#D9D7D0] focus:border-[#cd191a] focus:ring-2 focus:ring-[#cd191a]/20 outline-none transition-all resize-none bg-[#FAF9F5]"
              placeholder="Paste or type Sinhala text here..."
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={handleRunInference}
                disabled={isLoading || !inputText.trim()}
                className="inline-flex items-center gap-1.5 sm:gap-2 bg-[#cd191a] hover:bg-[#b01e1f] text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-xs uppercase tracking-wider shadow-md hover:shadow-lg disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-white" />
                    <span>Run {tool.toUpperCase()}</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  setInputText("");
                  setResultOutput(null);
                }}
                className="text-[11px] sm:text-xs text-[#8C8880] hover:text-[#181818] flex items-center gap-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-full hover:bg-[#F0EFEB] transition-colors"
              >
                <RotateCcw className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>Clear</span>
              </button>
            </div>

            <div className="text-[11px] sm:text-xs text-[#8C8880] font-medium">
              <span>{inputText.length} Chars</span> • <span>SinAi Beta (Sinhala Journal LLM)</span>
            </div>
          </div>

          {/* Results Output Section */}
          {resultOutput && (
            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-[#D9D7D0]/60 animate-in fade-in duration-300">
              <div className="flex items-center justify-between mb-2.5 sm:mb-3">
                <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#cd191a] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span>SinAi Model Output</span>
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-[11px] sm:text-xs text-[#615e58] hover:text-[#181818] bg-[#F0EFEB] hover:bg-[#E9E8E4] px-2.5 sm:px-3 py-1 rounded-full transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
              </div>

              <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-[#181818] text-white border border-white/10 font-sinhala text-sm sm:text-base md:text-lg leading-relaxed shadow-lg">
                {Array.isArray(resultOutput) ? (
                  <ul className="space-y-1.5 sm:space-y-2">
                    {resultOutput.map((item, i) => (
                      <li key={i} className="text-white/95">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-white/95">{resultOutput}</p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
