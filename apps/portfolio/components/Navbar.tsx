"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Sparkles, Menu, X, BookOpen, Layers, Cpu } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className="fixed top-3 sm:top-5 left-0 right-0 z-50 flex items-center justify-center px-3 sm:px-6 w-full pointer-events-none transition-all duration-300">
      <div
        className={`pointer-events-auto w-full max-w-[960px] flex items-center justify-between bg-[#151515]/90 backdrop-blur-xl rounded-full px-2.5 sm:px-4 py-1.5 sm:py-2 shadow-2xl border border-white/12 transition-all duration-300 ${
          scrolled ? "py-1.5 sm:py-2 bg-[#121212]/95 border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.35)]" : ""
        }`}
      >
        {/* Left: Brand Identity */}
        <Link href="#hero" className="flex items-center gap-1.5 sm:gap-2.5 pl-1 group">
          <Image
            src="/brand/web-app-manifest-192x192.png"
            alt="SinAi Logo"
            width={32}
            height={32}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full shadow-md group-hover:scale-105 transition-transform duration-300 shrink-0 object-cover"
          />
          <div className="flex items-center gap-1 sm:gap-1.5">
            <span className="text-white font-display text-base sm:text-lg font-bold tracking-tight">SinAi</span>
            <span className="hidden xs:inline text-[8px] sm:text-[9px] uppercase tracking-widest px-1 sm:px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-semibold border border-white/10">
              Beta
            </span>
          </div>
        </Link>

        {/* Center: Nav Links */}
        <nav className="hidden md:flex items-center gap-1 lg:gap-2 bg-white/5 px-2.5 py-1 rounded-full border border-white/5">
          <Link
            href="#research"
            className="text-[11px] lg:text-xs uppercase tracking-wider font-semibold text-white/70 hover:text-white hover:bg-white/10 px-2.5 lg:px-3 py-1 rounded-full transition-all duration-200"
          >
            Research
          </Link>
          <Link
            href="#capabilities"
            className="text-[11px] lg:text-xs uppercase tracking-wider font-semibold text-white/70 hover:text-white hover:bg-white/10 px-2.5 lg:px-3 py-1 rounded-full transition-all duration-200"
          >
            Capabilities
          </Link>
          <Link
            href="#ecosystem"
            className="text-[11px] lg:text-xs uppercase tracking-wider font-semibold text-white/70 hover:text-white hover:bg-white/10 px-2.5 lg:px-3 py-1 rounded-full transition-all duration-200"
          >
            Apps
          </Link>
          <Link
            href="#benchmarks"
            className="text-[11px] lg:text-xs uppercase tracking-wider font-semibold text-white/70 hover:text-white hover:bg-white/10 px-2.5 lg:px-3 py-1 rounded-full transition-all duration-200"
          >
            Benchmarks
          </Link>
          <Link
            href="#playground-simulator"
            className="text-[11px] lg:text-xs uppercase tracking-wider font-semibold text-[#fca5a5] hover:text-white hover:bg-[#cd191a]/30 px-2.5 lg:px-3 py-1 rounded-full transition-all duration-200 flex items-center gap-1"
          >
            <Sparkles className="w-3 h-3 text-[#f87171]" />
            Try SinAi
          </Link>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <a
            href="https://chat.sin-ai.app"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative inline-flex items-center gap-1 sm:gap-1.5 bg-gradient-to-r from-[#cd191a] to-[#dc4341] hover:from-[#b01e1f] hover:to-[#cd191a] text-white px-3 sm:px-4 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider shadow-lg shadow-[#cd191a]/25 hover:shadow-[#cd191a]/45 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            <span>Try SinAi</span>
            <ArrowUpRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </a>

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            aria-label="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-4 h-4 sm:w-5 sm:h-5" /> : <Menu className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="pointer-events-auto absolute top-14 sm:top-20 left-3 right-3 sm:left-4 sm:right-4 bg-[#151515]/98 backdrop-blur-2xl border border-white/15 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col gap-3 md:hidden z-50">
          <Link
            href="#research"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-white/80 hover:text-white py-2 border-b border-white/10"
          >
            <Cpu className="w-4 h-4 text-[#cd191a]" />
            Sinhala Journal LLM Research
          </Link>
          <Link
            href="#capabilities"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-white/80 hover:text-white py-2 border-b border-white/10"
          >
            <Layers className="w-4 h-4 text-[#cd191a]" />
            Linguistic Capabilities
          </Link>
          <Link
            href="#ecosystem"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-white/80 hover:text-white py-2 border-b border-white/10"
          >
            <BookOpen className="w-4 h-4 text-[#cd191a]" />
            Client Applications
          </Link>
          <Link
            href="#playground-simulator"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 text-xs sm:text-sm font-semibold text-[#f87171] hover:text-white py-2 border-b border-white/10"
          >
            <Sparkles className="w-4 h-4 text-[#f87171]" />
            Interactive Workspace
          </Link>
          <div className="pt-2 flex flex-col gap-2">
            <a
              href="https://chat.sin-ai.app"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 bg-[#cd191a] text-white py-2.5 sm:py-3 rounded-full text-xs font-bold uppercase tracking-wider text-center shadow-lg"
            >
              <span>Try SinAi Workspace</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
