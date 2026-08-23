import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ShieldCheck, Lock, ArrowLeft, Mail, CheckCircle2, Key, Server, EyeOff } from "lucide-react";

export default function DocsAddonPrivacyPage() {
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
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Google Workspace Privacy &amp; Compliance</span>
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold text-[#181818] tracking-tight mb-3">
            Privacy Policy for SinAI Document Assistant
          </h1>
          <p className="text-xs sm:text-sm text-[#8C8880]">
            Effective Date: August 13, 2026 • Applies specifically to the SinAI Document Assistant Google Docs Add-on
          </p>
        </div>

        {/* Content */}
        <div className="space-y-10 text-xs sm:text-sm leading-relaxed text-[#443f40]">
          {/* Section 1: Overview */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              1. Overview and Application Scope
            </h2>
            <p>
              This Privacy Policy applies to the <strong>SinAI Document Assistant</strong>, a Google Docs Add-on developed to assist users in writing, proofreading, summarizing, and editing Sinhala language text. We are deeply committed to protecting your privacy and ensuring complete transparency regarding how data is accessed, processed, and secured when you use our add-on within Google Docs.
            </p>
          </section>

          {/* Section 2: Google Workspace User Data Policy & Limited Use Disclosure */}
          <section className="space-y-4 p-5 sm:p-6 bg-white rounded-2xl border border-[#D9D7D0] shadow-sm">
            <div className="flex items-center gap-2 text-[#cd191a] font-bold text-sm uppercase tracking-wider">
              <Lock className="w-4 h-4" />
              <span>2. Google Workspace User Data &amp; Limited Use Disclosure</span>
            </div>
            <p>
              When you install and use <strong>SinAI Document Assistant</strong>, our access to your Google Docs data is strictly limited to the specific actions you trigger:
            </p>
            <ul className="space-y-2.5 pl-2">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Active Selection Access Only:</strong> The Add-on only reads text that you actively select or submit in the Google Docs interface to execute requested AI operations (grammar check, headline generation, style tone rewriting, or summarization).
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>No Access to Google Drive:</strong> The Add-on operates solely inside the currently opened document. It cannot view, scan, or modify any other files or folders in your Google Drive.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>No Model Training on User Document Data:</strong> We <strong>NEVER</strong> use your Google Docs content or selected text to train, fine-tune, or improve public or foundation machine learning models.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>No Data Selling or Advertising:</strong> We never sell, monetize, or transfer your Google Docs content to third-party data brokers, advertising networks, or marketing platforms.
                </span>
              </li>
            </ul>
            <div className="pt-2 p-3.5 rounded-xl bg-[#FAF9F5] border border-[#D9D7D0] text-xs">
              <strong>Google Limited Use Notice:</strong> SinAI Document Assistant&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#cd191a] font-semibold underline hover:text-[#b01e1f]"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </div>
          </section>

          {/* Section 3: OAuth Scopes Breakdown */}
          <section className="space-y-4">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              3. Requested OAuth Scopes &amp; Justifications
            </h2>
            <p>
              SinAI Document Assistant requires only the minimum necessary scopes to function inside Google Docs:
            </p>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-white border border-[#D9D7D0]">
                <div className="flex items-center gap-2 mb-1.5">
                  <Key className="w-4 h-4 text-[#cd191a]" />
                  <code className="text-xs font-bold text-[#181818]">
                    https://www.googleapis.com/auth/documents.currentonly
                  </code>
                </div>
                <p className="text-xs text-[#615e58]">
                  <strong>Purpose:</strong> Allows the Add-on to read the selected text in the active document to process grammar, style, or summaries, and insert or replace the corrected text upon your explicit click.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#D9D7D0]">
                <div className="flex items-center gap-2 mb-1.5">
                  <Key className="w-4 h-4 text-[#cd191a]" />
                  <code className="text-xs font-bold text-[#181818]">
                    https://www.googleapis.com/auth/script.container.ui
                  </code>
                </div>
                <p className="text-xs text-[#615e58]">
                  <strong>Purpose:</strong> Used exclusively to display the SinAI Document Assistant interactive sidebar interface inside Google Docs.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white border border-[#D9D7D0]">
                <div className="flex items-center gap-2 mb-1.5">
                  <Key className="w-4 h-4 text-[#cd191a]" />
                  <code className="text-xs font-bold text-[#181818]">
                    https://www.googleapis.com/auth/script.external_request
                  </code>
                </div>
                <p className="text-xs text-[#615e58]">
                  <strong>Purpose:</strong> Transmits the selected text securely via HTTPS to our dedicated NLP inference server (<code>https://sinhalajournalllm-ijw6.onrender.com/</code>) to compute linguistic corrections and stream results back in real time.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Data Retention & Security */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              4. Ephemeral Processing &amp; Data Security
            </h2>
            <p>
              <strong>Ephemeral Processing:</strong> All text payloads transmitted by the Add-on are processed strictly in volatile memory (RAM) during live inference. Once the AI response is delivered to your sidebar, the payload is immediately flushed from memory. We do not store or persist your Google Docs text on our backend servers.
            </p>
            <p>
              <strong>Encryption in Transit:</strong> All communication between your Google Docs editor and the SinAI backend is encrypted using industry-standard Transport Layer Security (TLS 1.3).
            </p>
          </section>

          {/* Section 5: Contact Information */}
          <section className="space-y-3 p-5 sm:p-6 bg-white rounded-2xl border border-[#D9D7D0]">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#181818] flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#cd191a]" />
              <span>5. Contact &amp; Privacy Officer</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#615e58]">
              If you have any questions, inquiries, or feedback regarding this Privacy Policy or your data handling in SinAI Document Assistant, please contact us:
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
