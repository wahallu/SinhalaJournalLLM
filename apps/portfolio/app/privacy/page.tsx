import React from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ShieldCheck, Lock, EyeOff, Server, ArrowLeft, Mail } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — SinAi & Google Workspace Add-on",
  description: "Privacy Policy for SinAi, including the SinAi Google Docs Add-on and web applications. Details on data handling, Google user data compliance, and security.",
};

export default function PrivacyPolicy() {
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
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Legal &amp; Compliance</span>
          </div>
          <h1 className="font-display text-3xl sm:text-5xl font-bold text-[#181818] tracking-tight mb-3">
            Privacy Policy
          </h1>
          <p className="text-xs sm:text-sm text-[#8C8880]">
            Effective Date: August 10, 2026 • Applies to SinAi Web App, Chrome Extension, and SinAi Google Docs Add-on
          </p>
        </div>

        {/* Content */}
        <div className="space-y-10 text-xs sm:text-sm leading-relaxed text-[#443f40]">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              1. Overview and Commitment to Privacy
            </h2>
            <p>
              SinAi (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) provides AI-assisted journalistic writing, grammar checking, headline generation, style rewriting, and summarization tools. We are committed to protecting your privacy and ensuring transparency in how your data is handled across our web applications, browser extensions, and the <strong>SinAi Google Docs Add-on</strong>.
            </p>
          </section>

          {/* Section 2: Google Workspace User Data Compliance */}
          <section className="space-y-4 p-5 sm:p-6 bg-white rounded-2xl border border-[#D9D7D0] shadow-sm">
            <div className="flex items-center gap-2 text-[#cd191a] font-bold text-sm uppercase tracking-wider">
              <Lock className="w-4 h-4" />
              <span>2. Google Workspace User Data Policy and Limited Use</span>
            </div>
            <p>
              When you use the <strong>SinAi Google Docs Add-on</strong>, our access to your Google Docs data is strictly limited to the functions you explicitly trigger:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Document Content Access:</strong> The Add-on only reads text that you actively select or submit within the Google Docs interface to perform requested linguistic operations (grammar checking, headline suggestions, tone rewriting, or summarization).
              </li>
              <li>
                <strong>No Broad Drive Scanning:</strong> The Add-on does not access, scan, or index other files, folders, metadata, or documents in your Google Drive.
              </li>
              <li>
                <strong>No Generalized Model Training on User Content:</strong> We do <strong>NOT</strong> use Google Workspace user data, selected text, or private document content to train, retrain, or fine-tune general artificial intelligence or commercial foundation models.
              </li>
              <li>
                <strong>Limited Use Disclosure:</strong> SinAi&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#cd191a] font-semibold underline hover:text-[#b01e1f]"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </li>
            </ul>
          </section>

          {/* Section 3: Data We Collect */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              3. Information We Collect
            </h2>
            <p>We collect and process only the minimum information necessary to provide our services:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Text Inputs:</strong> The Sinhala or Latin text you submit for inference. This text is processed in-memory and discarded upon completion of the inference request for unauthenticated/anonymous sessions.
              </li>
              <li>
                <strong>Account Information (Optional):</strong> If you create a user account on the SinAi Web App, we collect your email address and authentication credentials via Supabase Auth.
              </li>
              <li>
                <strong>Telemetry &amp; Security Metadata:</strong> To prevent abuse and enforce rate limits, we generate a one-way salted cryptographic hash of client IP addresses (<code>sha256(ip + salt)</code>). We never store raw IP addresses.
              </li>
            </ul>
          </section>

          {/* Section 4: Data Security & Storage */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              4. Data Transmission and Security
            </h2>
            <p>
              All communication between your browser, the Google Docs Add-on, and our inference gateway occurs over encrypted HTTPS (TLS 1.3). Access to authenticated user history in our database is strictly isolated using PostgreSQL <strong>Row-Level Security (RLS)</strong>, ensuring that only the authenticated user can access their saved records.
            </p>
          </section>

          {/* Section 5: Third Parties */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              5. Third-Party Sharing and Disclosures
            </h2>
            <p>
              We do <strong>not</strong> sell, rent, monetize, or trade your personal data or document content to advertisers, data brokers, or third parties. Data is transmitted solely to secure inference infrastructure to fulfill user-initiated requests.
            </p>
          </section>

          {/* Section 6: Data Retention & Deletion */}
          <section className="space-y-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#181818]">
              6. Data Retention and User Control
            </h2>
            <p>
              Anonymous requests made via the Chrome Extension, Google Docs Add-on, or public simulator are not stored. Authenticated users can review, clear, or permanently delete their history at any time from their account dashboard or by contacting us.
            </p>
          </section>

          {/* Section 7: Contact Us */}
          <section className="space-y-3 p-5 sm:p-6 bg-[#F0EFEB] rounded-2xl border border-[#D9D7D0]">
            <h2 className="font-display text-lg sm:text-xl font-bold text-[#181818] flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#cd191a]" />
              <span>7. Privacy Questions and Contact</span>
            </h2>
            <p>
              If you have any questions, concerns, or requests regarding this Privacy Policy or your data, please contact the SinAi Research &amp; Engineering Group:
            </p>
            <p className="font-medium text-[#181818]">
              Email: <a href="mailto:support@sin-ai.app" className="text-[#cd191a] underline">support@sin-ai.app</a> • GitHub: <a href="https://github.com/wahallu/SinhalaJournalLLM" target="_blank" rel="noopener noreferrer" className="text-[#cd191a] underline">github.com/wahallu/SinhalaJournalLLM</a>
            </p>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
