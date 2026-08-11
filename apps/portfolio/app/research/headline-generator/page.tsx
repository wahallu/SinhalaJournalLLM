import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ArrowLeft, CheckCircle2, Search, Crosshair, Gauge } from "lucide-react";
import Link from "next/link";

export default function HeadlineGeneratorPage() {
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
              Generation Engine
            </div>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-[#181818] tracking-tight leading-tight mb-6">
              Headline Generator
            </h1>
            <p className="text-lg sm:text-xl text-[#615e58] max-w-3xl leading-relaxed">
              Length-conditioned headline generation for Sinhala newsrooms. Generates engaging, contextually accurate headlines with strict adherence to designated word-count bands for different editorial layouts.
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#fdf3f2] flex items-center justify-center mb-4">
                <Crosshair className="w-5 h-5 text-[#cd191a]" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">In-Band Accuracy</p>
              <p className="text-3xl font-display font-bold text-[#181818]">79.7%</p>
              <p className="text-xs text-[#615e58] mt-2">Overall across 3 bands</p>
            </div>
            
            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#fdf3f2] flex items-center justify-center mb-4">
                <Search className="w-5 h-5 text-[#cd191a]" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Artifact Rate</p>
              <p className="text-3xl font-display font-bold text-[#181818]">1.1%</p>
              <p className="text-xs text-[#615e58] mt-2">Scraper tags effectively eliminated</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#fdf3f2] flex items-center justify-center mb-4">
                <Gauge className="w-5 h-5 text-[#cd191a]" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Length Control</p>
              <p className="text-3xl font-display font-bold text-[#181818]">3 Bands</p>
              <p className="text-xs text-[#615e58] mt-2">Short, Medium, and Long formats</p>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-[#D9D7D0] shadow-sm">
              <div className="w-10 h-10 rounded-xl bg-[#181818] flex items-center justify-center mb-4">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <p className="text-sm text-[#8C8880] font-bold uppercase tracking-wider mb-1">Adapter Version</p>
              <p className="text-3xl font-display font-bold text-[#181818]">v19</p>
              <p className="text-xs text-[#615e58] mt-2">Current production deployment</p>
            </div>
          </div>

          {/* Deep Dive Content */}
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D9D7D0] shadow-lg">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#181818] mb-8 border-b border-[#F0EFEB] pb-4">
              Architecture & Strategy
            </h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div>
                <h3 className="text-xl font-bold text-[#181818] mb-4 flex items-center gap-2">
                  <Gauge className="w-5 h-5 text-[#cd191a]" />
                  Length-Conditioning Mechanics
                </h3>
                <p className="text-[#615e58] leading-relaxed mb-6">
                  The model generates headlines specifically tailored to three non-overlapping word-count bands to support dynamic editorial layouts. The band defines the constraints for the prompt and controls minimum/maximum token bounds dynamically during inference.
                </p>
                <ul className="space-y-4">
                  <li className="bg-[#FAF9F5] p-4 rounded-xl border border-[#D9D7D0]">
                    <h4 className="font-bold text-[#181818] mb-1">Short Band</h4>
                    <p className="text-sm text-[#615e58]">3 to 5 words. Ideal for tight columns, mobile grids, or breaking news tickers.</p>
                  </li>
                  <li className="bg-[#FAF9F5] p-4 rounded-xl border border-[#D9D7D0]">
                    <h4 className="font-bold text-[#181818] mb-1">Medium Band</h4>
                    <p className="text-sm text-[#615e58]">6 to 7 words. The standard newsroom format for primary article thumbnails.</p>
                  </li>
                  <li className="bg-[#FAF9F5] p-4 rounded-xl border border-[#D9D7D0]">
                    <h4 className="font-bold text-[#181818] mb-1">Long Band</h4>
                    <p className="text-sm text-[#615e58]">8 to 10 words. Perfect for feature articles and detailed editorial deep-dives.</p>
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold text-[#181818] mb-4 flex items-center gap-2">
                  <Search className="w-5 h-5 text-[#cd191a]" />
                  Artifact Suppression
                </h3>
                <p className="text-[#615e58] leading-relaxed mb-6">
                  A common challenge with language models trained on scraped data is the retention of metadata artifacts (e.g., tags like <code>(වීඩියෝ)</code> or <code>[Photos]</code>). Through rigorous regex-based dataset cleaning procedures, we've successfully addressed this.
                </p>
                <div className="bg-[#fdf3f2] text-[#8d1213] p-5 rounded-xl border border-[#fce5e4]">
                  <h4 className="font-bold mb-2">The v19 Breakthrough</h4>
                  <p className="text-sm leading-relaxed mb-3">
                    By explicitly stripping trailing tags from every reference headline in the training set and recomputing word bands based on the cleaned text, the model learned to naturally suppress these artifacts.
                  </p>
                  <p className="text-sm font-semibold">
                    Result: Artifact rate plummeted ~10x (from 11.2% down to 1.1%) with no regression in length-conditioning accuracy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
