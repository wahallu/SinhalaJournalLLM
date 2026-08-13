import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FileText, ArrowLeft, Mail, CheckCircle2, AlertCircle } from "lucide-react";

export default function DocsAddonTermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] text-[#1B1B1B]">
      <Navbar />

      <main className="flex-1 pt-28 sm:pt-36 pb-20 px-4 sm:px-6 lg:px-12 max-w-4xl mx-auto w-full">
        {/* Back Link */}
        <div className="mb-8">
          <Link
            href="/docs-addon"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8C8880] hover:text-[#cd191a] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to SinAI Document Assistant Home</span>
          </Link>
        </div>

        {/* Header */}
        <div className="border-b border-[#D9D7D0] pb-8 mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#cd191a]/10 text-[#cd191a] text-xs font-bold uppercase tracking-widest mb-4">
            <FileText className="w-3.5 h-3.5" />
            <span>Legal Agreement</span>
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold text-[#181818] tracking-tight mb-3">
            Terms of Service for SinAI Document Assistant
          </h1>
          <p className="text-xs sm:text-sm text-[#8C8880]">
            Effective Date: August 13, 2026 • Applies specifically to the SinAI Document Assistant Google Docs Add-on
          </p>
        </div>

        {/* Content */}
        <div className="space-y-10 text-xs sm:text-sm leading-relaxed text-[#443f40]">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              1. Acceptance of Terms
            </h2>
            <p>
              By installing, accessing, or using the <strong>SinAI Document Assistant</strong> for Google Docs, you agree to be bound by these Terms of Service. If you do not agree with these Terms, please do not install or use the Add-on.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              2. License &amp; Permitted Use
            </h2>
            <p>
              We grant you a revocable, non-exclusive, non-transferable license to use <strong>SinAI Document Assistant</strong> within Google Docs for personal, editorial, journalistic, educational, or commercial drafting purposes in accordance with these Terms and the Google Workspace Marketplace Developer Agreement.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              3. AI-Assisted Output &amp; Disclaimers
            </h2>
            <p>
              <strong>SinAI Document Assistant</strong> uses natural language processing models specialized for the Sinhala language. While our models are rigorously fine-tuned to deliver high accuracy in grammar correction, headline formulation, register rewriting, and summarization, AI-generated suggestions should be reviewed and verified by human editors before final publication.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              4. Privacy &amp; Data Security
            </h2>
            <p>
              Your use of the Add-on is also governed by our{" "}
              <Link href="/docs-addon/privacy" className="text-[#cd191a] underline font-semibold">
                Privacy Policy for SinAI Document Assistant
              </Link>
              . Text processed by the Add-on is handled ephemerally and is never stored permanently or used to train public machine learning models.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-3 p-5 sm:p-6 bg-white rounded-2xl border border-[#D9D7D0]">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#181818] flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#cd191a]" />
              <span>5. Support and Inquiries</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#615e58]">
              For any questions regarding these Terms or technical support, please contact us at:
            </p>
            <div className="pt-2 text-xs text-[#181818]">
              <p><strong>Email:</strong> <a href="mailto:support@sin-ai.app" className="text-[#cd191a] underline font-semibold">support@sin-ai.app</a></p>
              <p><strong>Website:</strong> <a href="https://sin-ai.app/docs-addon" className="text-[#cd191a] underline font-semibold">https://sin-ai.app/docs-addon</a></p>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
