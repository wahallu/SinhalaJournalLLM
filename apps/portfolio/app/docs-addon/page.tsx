"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  FileSpreadsheet,
  CheckCircle2,
  Shield,
  Lock,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Zap,
  Heading,
  Wand2,
  FileText,
  Copy,
  Check,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Layers,
  Key,
  ShieldCheck,
  Server,
  RefreshCw,
  Sliders,
  Send,
  Eye,
  CornerDownLeft,
  BookOpen,
} from "lucide-react";

type InteractiveTab = "grammar" | "headlines" | "rewriter" | "summarizer" | "optimizer";

export default function DocsAddonPage() {
  const [activeTab, setActiveTab] = useState<InteractiveTab>("grammar");
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedTone, setSelectedTone] = useState<string>("formal");
  const [summaryLength, setSummaryLength] = useState<string>("medium");
  const [replacedInDoc, setReplacedInDoc] = useState<boolean>(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleReplace = () => {
    setReplacedInDoc(true);
    setTimeout(() => setReplacedInDoc(false), 3000);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] text-[#1B1B1B]">
      {/* Navigation */}
      <Navbar />

      <main className="flex-1 pt-24 sm:pt-32 pb-20">
        {/* ========================================================================= */}
        {/* HERO SECTION                                                              */}
        {/* ========================================================================= */}
        <section className="px-4 sm:px-6 lg:px-12 max-w-[1440px] mx-auto mb-16 sm:mb-24">
          {/* Breadcrumb / Category */}
          <div className="flex items-center gap-2 text-xs font-semibold text-[#8C8880] mb-6">
            <Link href="/" className="hover:text-[#cd191a] transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <Link href="/#ecosystem" className="hover:text-[#cd191a] transition-colors">
              Client Applications
            </Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-[#181818] font-bold">SinAI Document Assistant</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Hero Left: Copy & Value Proposition */}
            <div className="lg:col-span-7 flex flex-col items-start">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#cd191a]/10 border border-[#cd191a]/20 text-[#cd191a] text-xs font-bold uppercase tracking-wider mb-5">
                <FileSpreadsheet className="w-4 h-4 text-[#cd191a]" />
                <span>Google Workspace Marketplace Add-on</span>
              </div>

              <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[#181818] tracking-tight leading-[1.1] mb-3">
                SinAI Document Assistant
              </h1>

              <p className="text-base sm:text-lg lg:text-xl font-semibold text-[#cd191a] mb-5">
                AI-powered Sinhala writing assistant for Google Docs™
              </p>

              <p className="text-sm sm:text-base lg:text-lg text-[#615e58] leading-relaxed max-w-2xl mb-8">
                Empower your newsroom and drafting workflows with specialized Sinhala linguistic intelligence directly inside Google Docs. Instantly audit grammatical concord, generate captivating editorial headlines, rewrite between 5 journalistic registers, and summarize long-form articles without ever leaving your document editor.
              </p>

              {/* Primary Action Group */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 w-full sm:w-auto mb-8">
                <a
                  href="#interactive-demo"
                  className="inline-flex items-center justify-center gap-2 bg-[#cd191a] hover:bg-[#b01e1f] text-white px-6 py-3.5 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider shadow-lg shadow-[#cd191a]/25 hover:shadow-[#cd191a]/40 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Try Interactive Demo</span>
                </a>

                <Link
                  href="/support#setup"
                  className="inline-flex items-center justify-center gap-2 bg-white hover:bg-[#F0EFEB] text-[#181818] border border-[#D9D7D0] px-5 py-3.5 rounded-full text-xs sm:text-sm font-bold uppercase tracking-wider shadow-sm transition-all"
                >
                  <BookOpen className="w-4 h-4 text-[#615e58]" />
                  <span>Setup Guide</span>
                </Link>

                <a
                  href="#permissions"
                  className="inline-flex items-center justify-center gap-2 bg-[#FAF9F5] hover:bg-[#F0EFEB] text-[#615e58] hover:text-[#181818] px-4 py-3.5 rounded-full text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>OAuth Scopes &amp; Privacy</span>
                </a>
              </div>

              {/* Quick Trust Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full pt-6 border-t border-[#D9D7D0]">
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#8C8880]">Engine</span>
                  <span className="text-xs sm:text-sm font-bold text-[#181818]">Google Apps Script V8</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#8C8880]">Security</span>
                  <span className="text-xs sm:text-sm font-bold text-emerald-600">TLS 1.3 Encrypted</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#8C8880]">Data Retention</span>
                  <span className="text-xs sm:text-sm font-bold text-[#181818]">Ephemeral (Zero Stored)</span>
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[#8C8880]">Language</span>
                  <span className="text-xs sm:text-sm font-bold text-[#cd191a]">Sinhala (සිංහල) NLP</span>
                </div>
              </div>
            </div>

            {/* Hero Right: High-Impact Visual Card */}
            <div className="lg:col-span-5 bg-gradient-to-br from-[#1E1E1E] to-[#121212] rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-white/10 relative overflow-hidden">
              {/* Decorative background glow */}
              <div className="absolute -right-16 -top-16 w-48 h-48 bg-[#cd191a]/20 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex items-center justify-between pb-5 border-b border-white/10 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#cd191a] to-[#dc4341] flex items-center justify-center text-white shadow-md">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-base font-bold text-white">SinAI Document Assistant</h3>
                    <p className="text-[11px] text-white/60">Google Docs Workspace Plugin</p>
                  </div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Ready to Deploy
                </span>
              </div>

              <div className="space-y-4 text-xs sm:text-sm text-white/80 mb-6">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#f87171] shrink-0 mt-0.5" />
                  <span><strong>Native Sidebar Docking:</strong> Anchors directly alongside your document in Google Docs.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#f87171] shrink-0 mt-0.5" />
                  <span><strong>Single-Click Text Replacement:</strong> Swap grammatical errors or insert headlines in-place.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#f87171] shrink-0 mt-0.5" />
                  <span><strong>Domain-Adapted Sinhala AI:</strong> Powered by LoRA adapters trained on journalistic corpora.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#f87171] shrink-0 mt-0.5" />
                  <span><strong>Limited-Scope Privacy:</strong> Only accesses the current document when you highlight text.</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs flex items-center justify-between">
                <div>
                  <span className="text-white/60 block text-[10px] uppercase tracking-wider">Enterprise Distribution</span>
                  <span className="font-semibold text-white">Domain-wide or Individual install</span>
                </div>
                <Link
                  href="/support#enterprise"
                  className="text-xs font-bold text-[#fca5a5] hover:text-white flex items-center gap-1 uppercase tracking-wider"
                >
                  <span>Admin Info</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* INTERACTIVE WORKSPACE SIMULATOR: GOOGLE DOCS + SINAI SIDEBAR               */}
        {/* ========================================================================= */}
        <section id="interactive-demo" className="py-12 sm:py-20 px-4 sm:px-6 lg:px-12 bg-[#F0EFEB] border-y border-[#D9D7D0]">
          <div className="max-w-[1440px] mx-auto">
            {/* Section Header */}
            <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
              <span className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-[#cd191a] mb-2 block">
                Live Interactive Experience
              </span>
              <h2 className="font-display text-2xl sm:text-4xl md:text-5xl font-bold text-[#181818] tracking-tight mb-4">
                See SinAI Document Assistant in Action
              </h2>
              <p className="text-xs sm:text-sm md:text-base text-[#615e58]">
                Explore how journalists and editors operate the SinAi sidebar directly inside Google Docs to proofread, headline, restyle, and condense Sinhala articles.
              </p>
            </div>

            {/* Interactive Tool Selector Bar */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mb-8">
              <button
                onClick={() => setActiveTab("grammar")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === "grammar"
                    ? "bg-[#181818] text-white shadow-md scale-105"
                    : "bg-white text-[#615e58] border border-[#D9D7D0] hover:bg-[#FAF9F5]"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-[#cd191a]" />
                <span>1. Grammar Checker</span>
              </button>

              <button
                onClick={() => setActiveTab("headlines")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === "headlines"
                    ? "bg-[#181818] text-white shadow-md scale-105"
                    : "bg-white text-[#615e58] border border-[#D9D7D0] hover:bg-[#FAF9F5]"
                }`}
              >
                <Heading className="w-3.5 h-3.5 text-[#cd191a]" />
                <span>2. Headline Generator</span>
              </button>

              <button
                onClick={() => setActiveTab("rewriter")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === "rewriter"
                    ? "bg-[#181818] text-white shadow-md scale-105"
                    : "bg-white text-[#615e58] border border-[#D9D7D0] hover:bg-[#FAF9F5]"
                }`}
              >
                <Wand2 className="w-3.5 h-3.5 text-[#cd191a]" />
                <span>3. 5-Tone Style Rewriter</span>
              </button>

              <button
                onClick={() => setActiveTab("summarizer")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === "summarizer"
                    ? "bg-[#181818] text-white shadow-md scale-105"
                    : "bg-white text-[#615e58] border border-[#D9D7D0] hover:bg-[#FAF9F5]"
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-[#cd191a]" />
                <span>4. News Summarizer</span>
              </button>

              <button
                onClick={() => setActiveTab("optimizer")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${
                  activeTab === "optimizer"
                    ? "bg-[#cd191a] text-white shadow-md scale-105"
                    : "bg-white text-[#cd191a] border border-[#cd191a]/30 hover:bg-[#FAF9F5]"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Full Article Optimizer</span>
              </button>
            </div>

            {/* Simulated Google Docs Window Frame */}
            <div className="w-full bg-[#E5E3DC] rounded-2xl sm:rounded-3xl border border-[#D9D7D0] shadow-2xl overflow-hidden">
              {/* Google Docs Chrome Top Bar */}
              <div className="bg-[#FFFFFF] border-b border-[#D9D7D0] px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Image
                    src="/brand/web-app-manifest-192x192.png"
                    alt="Docs Icon"
                    width={24}
                    height={24}
                    className="rounded"
                  />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-semibold text-[#181818]">
                        ශ්‍රී ලංකා ආර්ථික වාර්තාව 2026 — කෙටුම්පත (Draft)
                      </span>
                      <span className="text-[10px] text-[#8C8880] px-1.5 py-0.5 rounded bg-[#F0EFEB] hidden sm:inline">
                        Saved to Drive
                      </span>
                    </div>
                    {/* Fake Menu */}
                    <div className="hidden md:flex items-center gap-3 text-[11px] text-[#615e58] font-medium pt-0.5">
                      <span className="hover:text-black cursor-pointer">File</span>
                      <span className="hover:text-black cursor-pointer">Edit</span>
                      <span className="hover:text-black cursor-pointer">View</span>
                      <span className="hover:text-black cursor-pointer">Insert</span>
                      <span className="hover:text-black cursor-pointer">Format</span>
                      <span className="hover:text-black cursor-pointer">Tools</span>
                      <span className="text-[#cd191a] font-bold cursor-pointer flex items-center gap-0.5">
                        <span>Extensions</span> ➔ <span>SinAI Document Assistant</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {replacedInDoc && (
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 animate-pulse">
                      ✓ Text Updated in Doc!
                    </span>
                  )}
                  <span className="text-[11px] font-bold text-[#8C8880] bg-[#FAF9F5] px-2.5 py-1 rounded-md border border-[#D9D7D0]">
                    Google Docs Simulation
                  </span>
                </div>
              </div>

              {/* Two Pane Editor Layout: Document Canvas on Left, Docked SinAi Sidebar on Right */}
              <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
                {/* LEFT PANE: Simulated Google Doc Paper */}
                <div className="lg:col-span-7 bg-[#E8E6DF] p-4 sm:p-8 flex justify-center items-start overflow-y-auto">
                  <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg border border-[#D9D7D0] p-6 sm:p-10 text-[#181818] min-h-[480px]">
                    <div className="border-b border-[#F0EFEB] pb-3 mb-6 flex justify-between items-center">
                      <span className="text-[11px] uppercase tracking-wider text-[#8C8880] font-semibold">
                        Google Document Canvas
                      </span>
                      <span className="text-[11px] text-[#8C8880]">Page 1 of 1</span>
                    </div>

                    {/* Dynamic Simulated Doc Content based on active tool */}
                    {activeTab === "grammar" && (
                      <div className="space-y-4 leading-relaxed font-sans text-xs sm:text-sm">
                        <h3 className="font-display font-bold text-base sm:text-lg text-[#181818]">
                          නව ආර්ථික ප්‍රතිපත්ති ප්‍රකාශය
                        </h3>
                        <p className="text-[#443f40]">
                          ඊයේ පස්වරුවේ කොළඹ බණ්ඩාරනායක ජාත්‍යන්තර සම්මන්ත්‍රණ ශාලාවේදී විශේෂ හමුවක් පැවැත්විණි.
                        </p>
                        {/* Highlighted Selection area */}
                        <div className={`p-3 rounded-lg border transition-all ${
                          replacedInDoc
                            ? "bg-emerald-50 border-emerald-300 text-emerald-950 font-medium"
                            : "bg-[#fef2f2] border-[#fca5a5] text-[#181818]"
                        }`}>
                          <div className="text-[10px] uppercase font-bold tracking-wider mb-1 flex items-center justify-between">
                            <span className={replacedInDoc ? "text-emerald-700" : "text-[#cd191a]"}>
                              {replacedInDoc ? "✓ Replaced in Document" : "Highlighted Active Selection"}
                            </span>
                            <span className="text-[#8C8880]">2 Sentences</span>
                          </div>
                          {replacedInDoc ? (
                            <p>
                              ජනාධිපතිවරයා ඊයේ පැවති උත්සවයේදී නව ආර්ථික ප්‍රතිපත්තිය <span className="bg-emerald-200 font-bold px-1 rounded">ප්‍රකාශ කළේය</span>. රටේ සංවර්ධනය සඳහා සියලු ජනතාව එක්විය යුතු වේ.
                            </p>
                          ) : (
                            <p>
                              ජනාධිපතිවරයා ඊයේ පැවති උත්සවයේදී නව ආර්ථික ප්‍රතිපත්තිය <span className="bg-red-200 underline decoration-red-500 font-semibold px-1 rounded">ප්‍රකාශ කළාය</span>. රටේ සංවර්ධනය සඳහා සියලු ජනතාව එක්විය යුතු වේ.
                            </p>
                          )}
                        </div>
                        <p className="text-[#615e58]">
                          මෙහිදී අදහස් දැක්වූ අමාත්‍යවරයා සඳහන් කළේ ඉදිරි මාස හය තුළ සියලු රාජ්‍ය ආයතන ඩිජිටල්කරණයට ලක් කරන බවයි.
                        </p>
                      </div>
                    )}

                    {activeTab === "headlines" && (
                      <div className="space-y-4 leading-relaxed font-sans text-xs sm:text-sm">
                        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block mb-1">
                            Selected Article Body for Headline Extraction
                          </span>
                          <p className="text-xs text-[#443f40]">
                            ශ්‍රී ලංකා මහ බැංකුව විසින් ප්‍රකාශයට පත් කරන ලද නවතම වාර්තාවට අනුව මෙරට උද්ධමනය තනි අංකයක මට්ටමකට පහත වැටී ඇති අතර විදේශ විනිමය සංචිතය ඩොලර් බිලියන 6 ඉක්මවා වර්ධනය වී තිබේ. මෙම වර්ධනය ඉදිරි කාර්තුව තුළ ආර්ථිකය ස්ථාවර මාවතකට ගෙන ඒමට පිටුවහලක් වනු ඇතැයි ආර්ථික විද්‍යාඥයෝ විශ්වාස කරති.
                          </p>
                        </div>
                        <p className="text-xs text-[#8C8880] italic">
                          ➔ The SinAi sidebar generates 5 distinct news angles (Breaking, Catchy, Formal, Question, Analytical) ready to be inserted directly as an H1 title.
                        </p>
                      </div>
                    )}

                    {activeTab === "rewriter" && (
                      <div className="space-y-4 leading-relaxed font-sans text-xs sm:text-sm">
                        <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block mb-1">
                            Original News Wire Draft
                          </span>
                          <p className="text-xs text-[#443f40]">
                            කෘෂිකර්ම දෙපාර්තමේන්තුව විසින් නවීන තාක්ෂණය භාවිත කරමින් වී වගාවේ අස්වැන්න ඉහළ නැංවීමේ නව වැඩසටහනක් ආරම්භ කර ඇත.
                          </p>
                        </div>
                        <p className="text-xs text-[#615e58]">
                          Active target tone selected in sidebar: <strong className="text-[#181818] capitalize">{selectedTone} Register</strong>.
                        </p>
                      </div>
                    )}

                    {activeTab === "summarizer" && (
                      <div className="space-y-4 leading-relaxed font-sans text-xs sm:text-sm">
                        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                            Long-Form Feature Article (Selected 4 paragraphs)
                          </span>
                          <p className="text-xs text-[#443f40]">
                            නව තාක්ෂණික විප්ලවයත් සමඟ මෙරට තොරතුරු තාක්ෂණ ක්ෂේත්‍රයේ රැකියා උත්පාදනය පසුගිය වසරට සාපේක්ෂව සියයට 35 කින් ඉහළ ගොස් තිබේ. විශේෂයෙන් කෘත්‍රිම බුද්ධිය (AI) සහ දත්ත විශ්ලේෂණය සම්බන්ධ ක්ෂේත්‍ර සඳහා ඉහළ ඉල්ලුමක් නිර්මාණය වී ඇත. දේශීය විශ්වවිද්‍යාල සහ උසස් අධ්‍යාපන ආයතන සිය විෂයමාලා කර්මාන්ත අවශ්‍යතාවලට ගැලපෙන පරිදි යාවත්කාලීන කිරීම මෙයට ප්‍රධාන හේතුවක් ලෙස හඳුනාගෙන තිබේ.
                          </p>
                        </div>
                      </div>
                    )}

                    {activeTab === "optimizer" && (
                      <div className="space-y-4 leading-relaxed font-sans text-xs sm:text-sm">
                        <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-800 block mb-1">
                            Entire Article Submission (Grammar + Headlines + Style + Summary)
                          </span>
                          <p className="text-xs text-[#443f40]">
                            The Optimizer pipeline passes the full draft through all 4 SinAi engines in sequence, generating an end-to-end editorial optimization brief.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT PANE: Docked SinAi Google Docs Glassmorphic Sidebar */}
                <div className="lg:col-span-5 bg-[#121212] text-white p-4 sm:p-6 border-l border-white/10 flex flex-col justify-between">
                  <div>
                    {/* Sidebar Header */}
                    <div className="flex items-center justify-between pb-3.5 border-b border-white/10 mb-4">
                      <div className="flex items-center gap-2">
                        <Image
                          src="/brand/web-app-manifest-192x192.png"
                          alt="SinAi Logo"
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                        <div>
                          <span className="font-display text-sm font-bold tracking-tight">SinAi</span>
                          <span className="text-[10px] text-white/60 ml-1.5 font-sans">Docs Assistant</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-semibold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Connected</span>
                      </div>
                    </div>

                    {/* Sidebar Selection Tracker */}
                    <div className="bg-white/5 border border-white/10 rounded-xl p-3 mb-4">
                      <div className="flex items-center justify-between text-[11px] text-white/70 font-semibold mb-1">
                        <span>Current Selection</span>
                        <button
                          className="text-[10px] text-[#fca5a5] hover:text-white flex items-center gap-1 uppercase"
                          title="Refresh Selection from Doc"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>Refresh</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-white/90 line-clamp-2 italic font-sans">
                        &quot;ජනාධිපතිවරයා ඊයේ පැවති උත්සවයේදී නව ආර්ථික ප්‍රතිපත්තිය ප්‍රකාශ කළාය...&quot;
                      </p>
                    </div>

                    {/* Dynamic Tool Content in Sidebar */}
                    {activeTab === "grammar" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                            Grammar Correction
                          </span>
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded">
                            1 Error Detected
                          </span>
                        </div>

                        {/* Result Output Card */}
                        <div className="bg-white/10 border border-white/15 rounded-xl p-3.5 text-xs text-white space-y-2">
                          <p className="leading-relaxed">
                            ජනාධිපතිවරයා ඊයේ පැවති උත්සවයේදී නව ආර්ථික ප්‍රතිපත්තිය <span className="bg-[#cd191a] text-white px-1.5 py-0.5 rounded font-bold">ප්‍රකාශ කළේය</span>. රටේ සංවර්ධනය සඳහා සියලු ජනතාව එක්විය යුතු වේ.
                          </p>
                          <div className="p-2 rounded bg-black/40 border border-white/10 text-[10px] text-white/80">
                            <strong>Explanation:</strong> Honorific noun &apos;ජනාධිපතිවරයා&apos; requires masculine verb suffix &apos;කළේය&apos; (corrected from &apos;කළාය&apos;).
                          </div>
                        </div>

                        {/* Single-Click Action Buttons */}
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <button
                            onClick={handleReplace}
                            className="w-full flex items-center justify-center gap-1.5 bg-[#cd191a] hover:bg-[#b01e1f] text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md active:scale-95"
                          >
                            <CornerDownLeft className="w-3.5 h-3.5" />
                            <span>Replace Text</span>
                          </button>
                          <button
                            onClick={() => handleCopy("ජනාධිපතිවරයා ඊයේ පැවති උත්සවයේදී නව ආර්ථික ප්‍රතිපත්තිය ප්‍රකාශ කළේය. රටේ සංවර්ධනය සඳහා සියලු ජනතාව එක්විය යුතු වේ.", "grammar")}
                            className="w-full flex items-center justify-center gap-1.5 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                          >
                            {copiedText === "grammar" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedText === "grammar" ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {activeTab === "headlines" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                            5 Generated Headlines
                          </span>
                          <span className="text-[10px] text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded">
                            Front-Page Ready
                          </span>
                        </div>

                        <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                          {[
                            { title: "උද්ධමනය තනි අංකයට පහත බසී: විදේශ සංචිත ඩොලර් බිලියන 6 ඉක්මවයි", tag: "Breaking" },
                            { title: "ශ්‍රී ලංකා ආර්ථිකයේ ප්‍රබල පිබිදීමක්: මහ බැංකු වාර්තාවෙන් හෙළිවන තතු", tag: "Front-Page" },
                            { title: "විදේශ විනිමය සංචිත ඉහළට — උද්ධමනය පාලනය වූ හැටි", tag: "Analytical" },
                          ].map((item, idx) => (
                            <div
                              key={idx}
                              onClick={handleReplace}
                              className="group p-2.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 cursor-pointer transition-all flex items-start justify-between gap-2"
                            >
                              <div>
                                <span className="text-[9px] uppercase font-bold text-[#f87171] block">
                                  {item.tag}
                                </span>
                                <p className="text-xs text-white group-hover:text-amber-200 transition-colors">
                                  {item.title}
                                </p>
                              </div>
                              <span className="text-[10px] text-white/50 group-hover:text-white shrink-0 mt-1">
                                Insert ➔
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeTab === "rewriter" && (
                      <div className="space-y-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-white/70 block">
                          Select Target Editorial Tone
                        </span>
                        <div className="grid grid-cols-3 gap-1.5">
                          {["formal", "sports", "youth", "editorial", "feature"].map((tone) => (
                            <button
                              key={tone}
                              onClick={() => setSelectedTone(tone)}
                              className={`py-1.5 px-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${
                                selectedTone === tone
                                  ? "bg-[#cd191a] text-white shadow-sm"
                                  : "bg-white/10 text-white/70 hover:bg-white/15"
                              }`}
                            >
                              {tone}
                            </button>
                          ))}
                        </div>

                        <div className="bg-white/10 border border-white/15 rounded-xl p-3 text-xs text-white space-y-2">
                          <span className="text-[9px] uppercase tracking-wider text-white/50 block">
                            {selectedTone} Output
                          </span>
                          <p className="leading-relaxed text-xs">
                            දේශීය වී වගාවේ ඵලදායිතාව ඉහළ නැංවීම ඉලක්ක කරගනිමින් කෘෂිකර්ම දෙපාර්තමේන්තුව නවීන තාක්ෂණික ප්‍රවේශයක් හඳුන්වා දීමට පියවර ගෙන තිබේ.
                          </p>
                        </div>

                        <button
                          onClick={handleReplace}
                          className="w-full flex items-center justify-center gap-1.5 bg-[#cd191a] hover:bg-[#b01e1f] text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md"
                        >
                          <CornerDownLeft className="w-3.5 h-3.5" />
                          <span>Replace Selection</span>
                        </button>
                      </div>
                    )}

                    {activeTab === "summarizer" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-white/70">
                            Summary Format
                          </span>
                          <div className="flex gap-1">
                            {["short", "medium", "long"].map((len) => (
                              <button
                                key={len}
                                onClick={() => setSummaryLength(len)}
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  summaryLength === len ? "bg-[#cd191a] text-white" : "bg-white/10 text-white/60"
                                }`}
                              >
                                {len}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="bg-white/10 border border-white/15 rounded-xl p-3 text-xs text-white space-y-2">
                          <ul className="list-disc list-inside space-y-1.5 text-xs text-white/90">
                            <li>තොරතුරු තාක්ෂණ රැකියා උත්පාදනය 35% කින් වර්ධනය වේ.</li>
                            <li>AI සහ දත්ත විශ්ලේෂණ ක්ෂේත්‍ර සඳහා ඉහළම ඉල්ලුම.</li>
                            <li>විශ්වවිද්‍යාල විෂයමාලා කර්මාන්ත අවශ්‍යතාවලට ගැලපෙන ලෙස යාවත්කාලීන කර ඇත.</li>
                          </ul>
                        </div>

                        <button
                          onClick={handleReplace}
                          className="w-full flex items-center justify-center gap-1.5 bg-white/15 hover:bg-white/25 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all"
                        >
                          <CornerDownLeft className="w-3.5 h-3.5" />
                          <span>Insert Bullet Points</span>
                        </button>
                      </div>
                    )}

                    {activeTab === "optimizer" && (
                      <div className="space-y-3">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-white/70 block">
                          Article Pipeline Status
                        </span>
                        <div className="space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between p-2 rounded bg-white/10">
                            <span>1. Grammar Concord</span>
                            <span className="text-emerald-400 font-bold">100% Harmonized</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-white/10">
                            <span>2. Headline Angles</span>
                            <span className="text-emerald-400 font-bold">5 Options Generated</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-white/10">
                            <span>3. Stylistic Register</span>
                            <span className="text-emerald-400 font-bold">Formal Journalistic</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded bg-white/10">
                            <span>4. Executive Summary</span>
                            <span className="text-emerald-400 font-bold">Condensed 3 Bullets</span>
                          </div>
                        </div>

                        <button
                          onClick={handleReplace}
                          className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#cd191a] to-[#dc4341] text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider shadow-lg hover:scale-[1.02] transition-transform"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Apply Complete Optimization</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Sidebar Footer Link */}
                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50">
                    <span>SinAI Newsroom v2.4</span>
                    <Link href="/privacy" className="hover:text-white transition-colors">
                      Privacy &amp; Security
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* CORE CAPABILITIES & NEWSROOM FEATURES                                     */}
        {/* ========================================================================= */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 max-w-[1440px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <span className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-[#cd191a] mb-2 block">
              Linguistic Features
            </span>
            <h2 className="font-display text-2xl sm:text-4xl md:text-5xl font-bold text-[#181818] tracking-tight mb-4">
              Everything Your Editorial Team Needs
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-[#615e58]">
              Engineered specifically for the complex grammar, morphological cases, and stylistic registers of the Sinhala language.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Card 1 */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#D9D7D0] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#cd191a]/10 flex items-center justify-center text-[#cd191a] mb-5">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-[#181818] mb-2">
                Syntactic Grammar &amp; Concord
              </h3>
              <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed mb-4">
                Detects intricate grammatical errors such as subject-verb agreement mismatches, honorific concord violations, and incorrect inflectional case suffixes.
              </p>
              <span className="text-[11px] font-bold text-[#cd191a] uppercase tracking-wider">
                LoRA v13 Grammar Engine
              </span>
            </div>

            {/* Card 2 */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#D9D7D0] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#cd191a]/10 flex items-center justify-center text-[#cd191a] mb-5">
                <Heading className="w-6 h-6" />
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-[#181818] mb-2">
                Journalistic Headline Generation
              </h3>
              <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed mb-4">
                Extracts the core news event and generates 5 punchy headline styles: Breaking, Front-Page, Catchy Hook, Analytical Inquiry, and Formal Broadcast.
              </p>
              <span className="text-[11px] font-bold text-[#cd191a] uppercase tracking-wider">
                LoRA v17 Editorial Headlines
              </span>
            </div>

            {/* Card 3 */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#D9D7D0] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#cd191a]/10 flex items-center justify-center text-[#cd191a] mb-5">
                <Wand2 className="w-6 h-6" />
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-[#181818] mb-2">
                5-Register Style Transformation
              </h3>
              <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed mb-4">
                Instantly retarget articles for different audiences: Formal News, Sports Commentary, Youth Culture, Editorial Opinion, and In-depth Feature stories.
              </p>
              <span className="text-[11px] font-bold text-[#cd191a] uppercase tracking-wider">
                LoRA v07 Register Transfer
              </span>
            </div>

            {/* Card 4 */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#D9D7D0] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#cd191a]/10 flex items-center justify-center text-[#cd191a] mb-5">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-[#181818] mb-2">
                Abstractive News Summarization
              </h3>
              <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed mb-4">
                Condenses multi-page reporting into high-impact bulleted briefings or executive executive summaries with configurable length controls (Short, Medium, Long).
              </p>
              <span className="text-[11px] font-bold text-[#cd191a] uppercase tracking-wider">
                LoRA v04 Condensation Engine
              </span>
            </div>

            {/* Card 5 */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#D9D7D0] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#cd191a]/10 flex items-center justify-center text-[#cd191a] mb-5">
                <CornerDownLeft className="w-6 h-6" />
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-[#181818] mb-2">
                In-Place Document Replacement
              </h3>
              <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed mb-4">
                No need to copy and paste manually. Single-click &apos;Replace Selection&apos; updates the highlighted sentences directly in Google Docs with zero formatting loss.
              </p>
              <span className="text-[11px] font-bold text-[#cd191a] uppercase tracking-wider">
                Google Docs API Automation
              </span>
            </div>

            {/* Card 6 */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#D9D7D0] shadow-sm hover:shadow-md transition-shadow">
              <div className="w-12 h-12 rounded-xl bg-[#cd191a]/10 flex items-center justify-center text-[#cd191a] mb-5">
                <Sliders className="w-6 h-6" />
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-[#181818] mb-2">
                Legacy Font Transcoding
              </h3>
              <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed mb-4">
                Built-in transcoder for legacy Sri Lankan newspaper archives (UBIN16S, FM-Abhaya, DL-Manel) to modern Unicode representation seamlessly.
              </p>
              <span className="text-[11px] font-bold text-[#cd191a] uppercase tracking-wider">
                ASCII to Unicode Transcoder
              </span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* GOOGLE WORKSPACE OAUTH SCOPES & PERMISSIONS (CRITICAL FOR VERIFICATION)    */}
        {/* ========================================================================= */}
        <section id="permissions" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 bg-white border-y border-[#D9D7D0]">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider mb-4">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Security &amp; OAuth Transparency</span>
              </div>
              <h2 className="font-display text-2xl sm:text-4xl font-bold text-[#181818] tracking-tight mb-3">
                OAuth Permissions &amp; Scopes Explained
              </h2>
              <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed">
                SinAI operates under the <strong>Principle of Least Privilege</strong>. We request only the absolute minimum permissions required to provide linguistic assistance in your active document.
              </p>
            </div>

            {/* Scope Breakdown Table */}
            <div className="space-y-4 mb-10">
              {/* Scope 1 */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-[#cd191a]" />
                    <code className="text-xs font-bold text-[#181818] bg-white px-2.5 py-1 rounded border border-[#D9D7D0]">
                      https://www.googleapis.com/auth/documents.currentonly
                    </code>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                    Current Document Only
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#181818] mb-1">
                  View and manage documents that this application has been installed in
                </h4>
                <p className="text-xs text-[#615e58] leading-relaxed">
                  <strong>Why it&apos;s needed:</strong> Allows SinAI to read text that you highlight or select, and replace or insert corrected Sinhala text back into the currently open document. <br />
                  <span className="text-[#cd191a] font-semibold">Privacy Guarantee:</span> The add-on has <strong>NO access</strong> to your Google Drive or other files. It cannot read any document except the specific one in which you explicitly launch the assistant.
                </p>
              </div>

              {/* Scope 2 */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-[#cd191a]" />
                    <code className="text-xs font-bold text-[#181818] bg-white px-2.5 py-1 rounded border border-[#D9D7D0]">
                      https://www.googleapis.com/auth/script.container.ui
                    </code>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                    User Interface
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#181818] mb-1">
                  Display and run third-party web content in prompts and sidebars inside Google applications
                </h4>
                <p className="text-xs text-[#615e58] leading-relaxed">
                  <strong>Why it&apos;s needed:</strong> Enables Google Docs to render the SinAI interactive sidebar pane docked beside your document, giving you easy access to grammar checking, headline choices, and tone controls.
                </p>
              </div>

              {/* Scope 3 */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0] shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-[#cd191a]" />
                    <code className="text-xs font-bold text-[#181818] bg-white px-2.5 py-1 rounded border border-[#D9D7D0]">
                      https://www.googleapis.com/auth/script.external_request
                    </code>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">
                    Encrypted API Gateway
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#181818] mb-1">
                  Connect to an external service
                </h4>
                <p className="text-xs text-[#615e58] leading-relaxed">
                  <strong>Why it&apos;s needed:</strong> Allows the sidebar to transmit the highlighted Sinhala text payload over encrypted HTTPS (TLS 1.3) to our dedicated inference server (<code className="bg-white px-1.5 py-0.5 rounded border text-[11px]">https://sinhalajournalllm.onrender.com/</code>) to compute linguistic corrections and stream results back in real time.
                </p>
              </div>
            </div>

            {/* Google User Data Policy & Limited Use Disclosure Box */}
            <div className="p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-[#FAF9F5] border-2 border-[#181818] space-y-4">
              <div className="flex items-center gap-2 text-[#cd191a] font-bold text-sm uppercase tracking-wider">
                <Lock className="w-4 h-4" />
                <span>Google API Services User Data Policy Compliance</span>
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-[#181818]">
                Adherence to Google Limited Use Requirements
              </h3>
              <p className="text-xs sm:text-sm text-[#443f40] leading-relaxed">
                SinAI&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#cd191a] underline font-semibold"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements:
              </p>
              <ul className="space-y-2 text-xs sm:text-sm text-[#443f40]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Ephemeral In-Memory Processing:</strong> Document text is processed in volatile memory only during active inference and is <strong>never stored permanently</strong> on our servers.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>No Model Training:</strong> Your Google Docs content is <strong>never used</strong> to train, fine-tune, or improve generalized or public machine learning models.</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span><strong>Zero Third-Party Advertising:</strong> We never sell, monetize, or transfer your Google Docs data to third-party data brokers or advertising networks.</span>
                </li>
              </ul>
              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-bold uppercase tracking-wider">
                <Link href="/privacy" className="text-[#cd191a] hover:underline flex items-center gap-1">
                  <span>Read Full Privacy Policy</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
                <Link href="/terms" className="text-[#615e58] hover:text-[#181818] flex items-center gap-1">
                  <span>Terms of Service</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
                <Link href="/support" className="text-[#615e58] hover:text-[#181818] flex items-center gap-1">
                  <span>Help &amp; Support Hub</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* HOW TO INSTALL & STEP-BY-STEP QUICK START GUIDE                           */}
        {/* ========================================================================= */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 max-w-[1440px] mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <span className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-[#cd191a] mb-2 block">
              Quick Start
            </span>
            <h2 className="font-display text-2xl sm:text-4xl md:text-5xl font-bold text-[#181818] tracking-tight mb-4">
              How to Install &amp; Use in 3 Simple Steps
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-[#615e58]">
              Get up and running in under two minutes. No complex configuration required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* Step 1 */}
            <div className="bg-[#FFFDF8] rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-[#D9D7D0] shadow-sm relative flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-full bg-[#181818] text-white flex items-center justify-center font-bold text-sm mb-5">
                  1
                </div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-[#181818] mb-2">
                  Install from Marketplace
                </h3>
                <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed mb-4">
                  Open the Google Workspace Marketplace listing for <strong>SinAI Document Assistant</strong> and click <strong>Install</strong> (or request Domain Install from your Google Workspace Administrator).
                </p>
              </div>
              <div className="pt-4 border-t border-[#F0EFEB] text-[11px] text-[#8C8880] font-semibold">
                Available for Gmail &amp; Google Workspace accounts
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-[#FFFDF8] rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-[#D9D7D0] shadow-sm relative flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-full bg-[#cd191a] text-white flex items-center justify-center font-bold text-sm mb-5">
                  2
                </div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-[#181818] mb-2">
                  Launch the Sidebar
                </h3>
                <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed mb-4">
                  Open any document in Google Docs. In the top navigation menu, click: <br />
                  <span className="font-semibold text-[#181818]">Extensions ➔ SinAI Document Assistant ➔ Open Assistant</span>. The glassmorphic editor sidebar will slide open on the right.
                </p>
              </div>
              <div className="pt-4 border-t border-[#F0EFEB] text-[11px] text-[#8C8880] font-semibold">
                Docked smoothly next to your document draft
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-[#FFFDF8] rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-[#D9D7D0] shadow-sm relative flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-full bg-[#181818] text-white flex items-center justify-center font-bold text-sm mb-5">
                  3
                </div>
                <h3 className="font-display text-lg sm:text-xl font-bold text-[#181818] mb-2">
                  Highlight &amp; Transform
                </h3>
                <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed mb-4">
                  Select any Sinhala text in your document, pick a tool in the sidebar (Grammar, Headlines, Style, Summary), review the suggestions, and press <strong>Replace Selection</strong> or <strong>Insert</strong>.
                </p>
              </div>
              <div className="pt-4 border-t border-[#F0EFEB] text-[11px] text-[#8C8880] font-semibold">
                Instant GPU inference under 800ms
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* FREQUENTLY ASKED QUESTIONS & SUPPORT HUB                                  */}
        {/* ========================================================================= */}
        <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-12 bg-white border-t border-[#D9D7D0]">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <span className="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-[#cd191a] mb-2 block">
                Verification &amp; Enterprise FAQ
              </span>
              <h2 className="font-display text-2xl sm:text-4xl font-bold text-[#181818] tracking-tight mb-3">
                Frequently Asked Questions
              </h2>
              <p className="text-xs sm:text-sm text-[#615e58]">
                Common inquiries regarding SinAI Document Assistant installation, verification, and support.
              </p>
            </div>

            <div className="space-y-4">
              {/* FAQ 1 */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]">
                <h3 className="font-display text-base sm:text-lg font-bold text-[#181818] mb-2">
                  Does SinAI store or log the text I write in Google Docs?
                </h3>
                <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed">
                  No. SinAI processes document text ephemerally in RAM during real-time inference. Once the grammar suggestion, headline, or summary is returned to your sidebar, the payload is immediately discarded. We do not store, retain, or sell your document content.
                </p>
              </div>

              {/* FAQ 2 */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]">
                <h3 className="font-display text-base sm:text-lg font-bold text-[#181818] mb-2">
                  Can newsroom administrators deploy SinAI domain-wide?
                </h3>
                <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed">
                  Yes. Google Workspace Domain Administrators can install SinAI Document Assistant for all organizational units or specific editorial departments with a single click via the Google Admin Console.
                </p>
              </div>

              {/* FAQ 3 */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]">
                <h3 className="font-display text-base sm:text-lg font-bold text-[#181818] mb-2">
                  Do I need a paid account or API key to use the Google Docs Add-on?
                </h3>
                <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed">
                  No API key is required. The Google Docs Add-on connects out of the box to the public SinAI API gateway. Optional account creation is available if you wish to sync your saved edit history across the Web App, Chrome Extension, and Docs Addon.
                </p>
              </div>

              {/* FAQ 4 */}
              <div className="p-5 sm:p-6 rounded-2xl bg-[#FAF9F5] border border-[#D9D7D0]">
                <h3 className="font-display text-base sm:text-lg font-bold text-[#181818] mb-2">
                  How can I contact technical support or report an issue?
                </h3>
                <p className="text-xs sm:text-sm text-[#615e58] leading-relaxed">
                  You can reach our dedicated engineering and support team directly at{" "}
                  <a href="mailto:support@sin-ai.app" className="text-[#cd191a] font-bold underline">
                    support@sin-ai.app
                  </a>{" "}
                  or by opening an issue on our official GitHub repository. Visit our{" "}
                  <Link href="/support" className="text-[#cd191a] font-bold underline">
                    Help &amp; Support Hub
                  </Link>{" "}
                  for detailed troubleshooting steps.
                </p>
              </div>
            </div>

            {/* Support CTA Banner */}
            <div className="mt-10 p-6 sm:p-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#1E1E1E] to-[#121212] text-white flex flex-col sm:flex-row items-center justify-between gap-6 border border-white/10">
              <div>
                <h4 className="font-display text-lg sm:text-xl font-bold text-white mb-1">
                  Need newsroom onboarding or custom integrations?
                </h4>
                <p className="text-xs text-white/70">
                  Our research team assists media organizations with domain deployment and specialized stylistic adapters.
                </p>
              </div>
              <a
                href="mailto:support@sin-ai.app"
                className="inline-flex items-center justify-center gap-2 bg-[#cd191a] hover:bg-[#b01e1f] text-white px-5 py-3 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg transition-all shrink-0"
              >
                <span>Contact Engineering</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Obsidian Footer */}
      <Footer />
    </div>
  );
}
