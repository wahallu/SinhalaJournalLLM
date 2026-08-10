import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FileText, ArrowLeft, CheckCircle2, AlertCircle, Mail } from "lucide-react";

export const metadata = {
  title: "Terms of Service — SinAi & Google Workspace Add-on",
  description: "Terms of Service for SinAi writing assistant, Google Docs Add-on, and web services. Outlines acceptable use, AI output disclaimers, and user rights.",
};

export default function TermsOfService() {
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
            <FileText className="w-3.5 h-3.5" />
            <span>Legal Agreement</span>
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold text-[#181818] tracking-tight mb-3">
            Terms of Service
          </h1>
          <p className="text-xs sm:text-sm text-[#8C8880]">
            Effective Date: August 10, 2026 • Applies to SinAi Web App, Chrome Extension, and Google Docs Add-on
          </p>
        </div>

        {/* Content */}
        <div className="space-y-10 text-xs sm:text-sm leading-relaxed text-[#443f40]">
          {/* Section 1: Agreement */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using the SinAi Web App, Chrome Extension, or the <strong>SinAi Google Docs Add-on</strong> (collectively, the &quot;Services&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree with these Terms, please do not install or use our Services.
            </p>
          </section>

          {/* Section 2: License & Google Docs Integration */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              2. License and Use of Services
            </h2>
            <p>
              We grant you a non-exclusive, non-transferable, revocable license to install and use the SinAi Google Docs Add-on and web tools for personal, academic, or commercial journalistic drafting and editing purposes, in compliance with applicable laws and Google Workspace marketplace guidelines.
            </p>
          </section>

          {/* Section 3: AI-Generated Content Disclaimer */}
          <section className="space-y-4 p-5 sm:p-6 bg-white rounded-2xl border border-[#D9D7D0] shadow-sm">
            <div className="flex items-center gap-2 text-[#cd191a] font-bold text-sm uppercase tracking-wider">
              <AlertCircle className="w-4 h-4" />
              <span>3. AI-Generated Output and Editorial Responsibility</span>
            </div>
            <p>
              SinAi utilizes domain-adapted neural language models (SinLLaMA) to provide grammatical corrections, headline suggestions, stylistic rewrites, and summaries in the Sinhala language.
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[#443f40]">
              <li>
                <strong>Editorial Review Required:</strong> AI-generated outputs are probabilistic recommendations. Journalists, writers, and editors retain full responsibility for reviewing, fact-checking, and verifying the accuracy and appropriateness of any generated text prior to publication.
              </li>
              <li>
                <strong>Ownership of Content:</strong> You retain full ownership and intellectual property rights in the text you submit to SinAi and the resulting output generated for your documents.
              </li>
            </ul>
          </section>

          {/* Section 4: Acceptable Use */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              4. Acceptable Use Policy
            </h2>
            <p>You agree not to use SinAi to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Generate defamatory, abusive, harassing, hateful, or unlawful content.</li>
              <li>Attempt to reverse-engineer, decompile, or bypass rate limits and security perimeters of the API gateway.</li>
              <li>Interfere with or disrupt the integrity or performance of the Services or associated networks.</li>
            </ul>
          </section>

          {/* Section 5: Disclaimer of Warranties */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              5. Disclaimer of Warranties
            </h2>
            <p>
              The Services are provided on an &quot;as is&quot; and &quot;as available&quot; basis without warranties of any kind, either express or implied, including, but not limited to, implied warranties of merchantability, fitness for a particular purpose, or non-infringement.
            </p>
          </section>

          {/* Section 6: Limitation of Liability */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              6. Limitation of Liability
            </h2>
            <p>
              In no event shall SinAi, its researchers, or contributors be liable for any indirect, incidental, special, consequential, or punitive damages arising from the use of or inability to use the Services.
            </p>
          </section>

          {/* Section 7: Contact */}
          <section className="space-y-3 p-5 sm:p-6 bg-[#F0EFEB] rounded-2xl border border-[#D9D7D0]">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#181818] flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#cd191a]" />
              <span>7. Contact and Inquiries</span>
            </h2>
            <p>
              For legal questions or notices regarding these Terms, please reach out to:
            </p>
            <p className="font-medium text-[#181818]">
              Email: <a href="mailto:support@sinai.ai" className="text-[#cd191a] underline">support@sinai.ai</a> • Project: <a href="https://github.com/wahallu/SinhalaJournalLLM" target="_blank" rel="noopener noreferrer" className="text-[#cd191a] underline">SinAi Research &amp; Engineering</a>
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
