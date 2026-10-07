import { GitBranch, Mail, MessageSquareText } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui";
import { SITE } from "@/content/site";

export default function ContactSection() {
  return (
    <Section id="contact" tone="panel">
      <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
        <SectionHeader title="Contact" className="mb-0 lg:col-span-7" />
        <div className="grid gap-3 lg:col-span-5">
          <a
            href={`mailto:${SITE.supportEmail}`}
            className="group flex items-center justify-between rounded-2xl border border-line bg-white p-5 transition-colors hover:border-crimson"
          >
            <span className="flex items-center gap-3">
              <Mail aria-hidden="true" className="h-5 w-5 text-crimson" />
              <span>
                <span className="block text-sm font-semibold text-black-main">Email support</span>
                <span className="block text-sm text-[#5f5c56]">{SITE.supportEmail}</span>
              </span>
            </span>
            <MessageSquareText aria-hidden="true" className="h-5 w-5 text-text-muted group-hover:text-crimson" />
          </a>
          <a
            href={SITE.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-between rounded-2xl border border-line bg-white p-5 transition-colors hover:border-crimson"
          >
            <span className="flex items-center gap-3">
              <GitBranch aria-hidden="true" className="h-5 w-5 text-crimson" />
              <span>
                <span className="block text-sm font-semibold text-black-main">Source repository</span>
                <span className="block text-sm text-[#5f5c56]">SinhalaJournalLLM</span>
              </span>
            </span>
          </a>
        </div>
      </div>
    </Section>
  );
}
