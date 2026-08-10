import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  LifeBuoy,
  ArrowLeft,
  FileSpreadsheet,
  CheckCircle2,
  HelpCircle,
  Bug,
  Mail,
  Settings,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

export const metadata = {
  title: "Support & Help Center — SinAi Google Docs Add-on",
  description: "Setup guide, support resources, troubleshooting, and issue reporting for the SinAi Google Docs Add-on and writing platform.",
};

export default function SupportCenter() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] text-[#1B1B1B]">
      <Navbar />

      <main className="flex-1 pt-28 sm:pt-36 pb-20 px-4 sm:px-6 lg:px-12 max-w-4xl mx-auto w-full">
        {/* Back Link */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8C8880] hover:text-[#cd191a] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </Link>
        </div>

        {/* Header */}
        <div className="border-b border-[#D9D7D0] pb-8 mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#cd191a]/10 text-[#cd191a] text-xs font-bold uppercase tracking-widest mb-4">
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Help &amp; Support Hub</span>
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold text-[#181818] tracking-tight mb-3">
            SinAi Support Center
          </h1>
          <p className="text-xs sm:text-sm text-[#8C8880]">
            Setup guides, administrator configuration, troubleshooting, and issue reporting for SinAi and the Google Docs Add-on.
          </p>
        </div>

        {/* Content */}
        <div className="space-y-12 text-xs sm:text-sm leading-relaxed text-[#443f40]">
          {/* Section 1: Google Docs Add-on Setup Guide */}
          <section id="setup" className="space-y-4 p-6 sm:p-8 bg-white rounded-2xl sm:rounded-3xl border border-[#D9D7D0] shadow-sm">
            <div className="flex items-center gap-2.5 text-[#cd191a] font-bold text-sm sm:text-base uppercase tracking-wider">
              <FileSpreadsheet className="w-5 h-5" />
              <span>Google Docs Add-on: Step-by-Step Setup Guide</span>
            </div>
            <p className="text-xs sm:text-sm text-[#615e58]">
              Once you have installed <strong>SinAi for Google Docs</strong> from the Google Workspace Marketplace, follow these steps to start editing:
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]">
                <span className="w-6 h-6 rounded-full bg-[#cd191a] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  1
                </span>
                <div>
                  <h4 className="font-bold text-[#181818] text-xs sm:text-sm">Open Any Google Document</h4>
                  <p className="text-[11px] sm:text-xs text-[#615e58] mt-0.5">
                    Navigate to <a href="https://docs.google.com" target="_blank" rel="noopener noreferrer" className="text-[#cd191a] underline">docs.google.com</a> and open an existing draft or create a new blank document.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]">
                <span className="w-6 h-6 rounded-full bg-[#cd191a] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  2
                </span>
                <div>
                  <h4 className="font-bold text-[#181818] text-xs sm:text-sm">Launch from the Extensions Menu</h4>
                  <p className="text-[11px] sm:text-xs text-[#615e58] mt-0.5">
                    Click <strong>Extensions</strong> in the top menu bar &rarr; select <strong>SinAi Document Assistant</strong> &rarr; click <strong>Open Sidebar</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0]">
                <span className="w-6 h-6 rounded-full bg-[#cd191a] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  3
                </span>
                <div>
                  <h4 className="font-bold text-[#181818] text-xs sm:text-sm">Highlight Text &amp; Run AI Tools</h4>
                  <p className="text-[11px] sm:text-xs text-[#615e58] mt-0.5">
                    Select any Sinhala text paragraph in your document, choose your desired task (Grammar Correction, Headline Generation, 5-Tone Rewrite, or Summary), and click <strong>Replace / Insert</strong> to update your document instantly.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Workspace Admin Configuration */}
          <section id="admin" className="space-y-4 p-6 sm:p-8 bg-[#F0EFEB] rounded-2xl sm:rounded-3xl border border-[#D9D7D0]">
            <div className="flex items-center gap-2.5 text-[#181818] font-bold text-sm sm:text-base uppercase tracking-wider">
              <Settings className="w-5 h-5 text-[#cd191a]" />
              <span>Workspace Admin Configuration</span>
            </div>
            <p className="text-xs sm:text-sm text-[#615e58]">
              Google Workspace administrators can deploy SinAi domain-wide across all journalists, editors, and newsroom accounts:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[#443f40] text-xs sm:text-sm">
              <li>
                <strong>Domain Installation:</strong> Go to the Google Workspace Admin Console &rarr; <em>Apps</em> &rarr; <em>Google Workspace Marketplace apps</em> &rarr; <em>Apps list</em> &rarr; click <em>Install app</em> and search for <strong>SinAi Document Assistant</strong>.
              </li>
              <li>
                <strong>Organizational Units (OUs):</strong> You can grant access to the entire newsroom domain or target specific organizational units (e.g., Editorial Dept, Sub-Editors).
              </li>
              <li>
                <strong>Data Governance:</strong> The add-on requires minimal scopes (reading selected document text only) and enforces strict per-user RLS data isolation.
              </li>
            </ul>
          </section>

          {/* Section 3: Frequently Asked Questions */}
          <section id="faq" className="space-y-4">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818] flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-[#cd191a]" />
              <span>Frequently Asked Questions</span>
            </h2>

            <div className="space-y-3">
              <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#D9D7D0]">
                <h3 className="font-bold text-[#181818] text-xs sm:text-sm mb-1.5">
                  Does SinAi support older FM / DL newsroom ASCII fonts?
                </h3>
                <p className="text-xs sm:text-sm text-[#615e58]">
                  Yes! SinAi includes an integrated legacy transcoder that decodes ASCII-encoded Sinhala newsroom archives into Unicode before performing linguistic corrections.
                </p>
              </div>

              <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#D9D7D0]">
                <h3 className="font-bold text-[#181818] text-xs sm:text-sm mb-1.5">
                  Do I need an account to use the Google Docs Add-on?
                </h3>
                <p className="text-xs sm:text-sm text-[#615e58]">
                  No, the Add-on works out-of-the-box in anonymous trial mode. If you want cross-device history and elevated rate limits, you can sign in with your SinAi account.
                </p>
              </div>

              <div className="p-4 sm:p-5 bg-white rounded-2xl border border-[#D9D7D0]">
                <h3 className="font-bold text-[#181818] text-xs sm:text-sm mb-1.5">
                  Is my document content used to train public AI models?
                </h3>
                <p className="text-xs sm:text-sm text-[#615e58]">
                  No. We adhere to the Google API Services User Data Policy. Your document text is processed in-memory solely to fulfill the requested inference pass and is never used to train generalized models.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Report an Issue */}
          <section id="report-issue" className="space-y-4 p-6 sm:p-8 bg-white rounded-2xl sm:rounded-3xl border border-[#D9D7D0] shadow-sm">
            <div className="flex items-center gap-2.5 text-[#cd191a] font-bold text-sm sm:text-base uppercase tracking-wider">
              <Bug className="w-5 h-5" />
              <span>Report an Issue / Technical Support</span>
            </div>
            <p className="text-xs sm:text-sm text-[#615e58]">
              Encountered a bug, unexpected grammatical output, or experiencing technical difficulty? We welcome your feedback:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <a
                href="https://github.com/wahallu/SinhalaJournalLLM/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] hover:border-[#cd191a] transition-all flex flex-col justify-between group"
              >
                <div>
                  <span className="font-bold text-[#181818] text-xs sm:text-sm block mb-1">
                    GitHub Issue Tracker
                  </span>
                  <p className="text-[11px] sm:text-xs text-[#615e58]">
                    Submit bug reports, feature requests, and review open issues in our open repository.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#cd191a] mt-3">
                  <span>Open GitHub Issues</span>
                  <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </div>
              </a>

              <a
                href="mailto:support@sinai.ai"
                className="p-4 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] hover:border-[#cd191a] transition-all flex flex-col justify-between group"
              >
                <div>
                  <span className="font-bold text-[#181818] text-xs sm:text-sm block mb-1">
                    Direct Email Support
                  </span>
                  <p className="text-[11px] sm:text-xs text-[#615e58]">
                    Reach our core engineering and computational linguistics team at support@sinai.ai.
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#cd191a] mt-3">
                  <span>support@sinai.ai</span>
                  <Mail className="w-3.5 h-3.5" />
                </div>
              </a>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
