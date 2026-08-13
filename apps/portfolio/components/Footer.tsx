"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Sparkles, BookOpen } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-[#121212] text-white pt-14 sm:pt-20 pb-8 sm:pb-12 px-4 sm:px-6 lg:px-12 rounded-t-[32px] sm:rounded-t-[64px] relative z-20 border-t border-white/10">
      <div className="max-w-[1560px] mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 sm:gap-12 mb-12 sm:mb-16">
          {/* Brand Column (2 cols wide on lg) */}
          <div className="sm:col-span-2 flex flex-col gap-4 sm:gap-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <Image
                src="/brand/web-app-manifest-192x192.png"
                alt="SinAi Logo"
                width={36}
                height={36}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl shadow-md object-cover"
              />
              <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white">
                SinAi
              </span>
            </div>

            <p className="text-xs sm:text-sm text-white/60 max-w-sm leading-relaxed">
              The domain-adapted AI writing &amp; journalistic intelligence ecosystem for the Sinhala language. Powered by the Sinhala Journal LLM research project and specialized task LoRA adapters.
            </p>

            <div className="flex gap-2.5 sm:gap-3 pt-1 sm:pt-2">
              <a
                href="https://github.com/wahallu/SinhalaJournalLLM"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors text-white/80 hover:text-white"
                aria-label="GitHub Repository"
              >
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                </svg>
              </a>
              <a
                href="https://chat.sin-ai.app"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-white/15 flex items-center justify-center hover:bg-[#cd191a] hover:border-[#cd191a] transition-all text-white/80 hover:text-white"
                aria-label="Try SinAi Workspace"
              >
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </a>
              <a
                href="https://github.com/wahallu/SinhalaJournalLLM/tree/main/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-white/15 flex items-center justify-center hover:bg-white/10 transition-colors text-white/80 hover:text-white"
                aria-label="Documentation"
              >
                <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </a>
            </div>
          </div>

          {/* Column 2: Client Applications */}
          <div>
            <h4 className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-widest mb-3 sm:mb-5">
              Client Apps
            </h4>
            <ul className="space-y-2 sm:space-y-3 text-[11px] sm:text-xs text-white/60">
              <li>
                <a
                  href="https://chat.sin-ai.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  SinAi Workspace
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/wahallu/SinhalaJournalLLM/tree/main/apps/chrome-extension"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Chrome Extension (MV3)
                </a>
              </li>
              <li>
                <Link
                  href="/docs-addon"
                  className="hover:text-white transition-colors"
                >
                  SinAI Document Assistant (Docs)
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Research & Adapters */}
          <div>
            <h4 className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-widest mb-3 sm:mb-5">
              Research &amp; Models
            </h4>
            <ul className="space-y-2 sm:space-y-3 text-[11px] sm:text-xs text-white/60">
              <li>
                <Link href="/research/grammar-checker" className="hover:text-white transition-colors">
                  Grammar Checker (v22)
                </Link>
              </li>
              <li>
                <Link href="/research/headline-generator" className="hover:text-white transition-colors">
                  Headline Generator (v19)
                </Link>
              </li>
              <li>
                <Link href="/research/style-rewriter" className="hover:text-white transition-colors">
                  Style Rewriter (v07)
                </Link>
              </li>
              <li>
                <Link href="/research/news-summarizer" className="hover:text-white transition-colors">
                  News Summarizer (v06)
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Documentation & Support */}
          <div>
            <h4 className="text-[11px] sm:text-xs font-bold text-white uppercase tracking-widest mb-3 sm:mb-5">
              Support &amp; Legal
            </h4>
            <ul className="space-y-2 sm:space-y-3 text-[11px] sm:text-xs text-white/60">
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-white transition-colors">
                  Support &amp; Setup Guide
                </Link>
              </li>
              <li>
                <Link href="/support#report-issue" className="hover:text-white transition-colors">
                  Report an Issue
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/wahallu/SinhalaJournalLLM"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  GitHub Repository
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright Bar */}
        <div className="pt-6 sm:pt-8 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-white/40 text-center sm:text-left">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 sm:gap-4">
            <p>© 2026 SinAi Research &amp; Engineering Group.</p>
            <span>•</span>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms
            </Link>
            <span>•</span>
            <Link href="/support" className="hover:text-white transition-colors">
              Support
            </Link>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <span>Built for Sri Lankan Journalism</span>
            <span>•</span>
            <span className="text-[#cd191a] font-bold">SinAi Beta</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
