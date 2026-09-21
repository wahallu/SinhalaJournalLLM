import { ShieldCheck } from "lucide-react";
import { SECURITY } from "@/content/research";
import { STACK } from "@/content/stack";
import { TIMELINE } from "@/content/timeline";
import { SITE } from "@/content/site";
import { ButtonLink, Section, SectionHeader } from "@/components/ui";

export function SecuritySection() {
  return (
    <Section id="security">
      <SectionHeader
        eyebrow="Security and reliability"
        title="Built to be trusted with a newsroom’s drafts."
        lede="Plain version: your account is protected, your history is only yours, and a failure in one part does not take the whole service down."
      />
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {SECURITY.map((s) => (
          <li key={s.title} className="rounded-3xl border border-line bg-white p-6">
            <ShieldCheck aria-hidden="true" className="h-6 w-6 text-crimson" />
            <h3 className="mt-4 text-lg font-semibold text-black-main">{s.title}</h3>
            <p className="mt-2 text-base leading-relaxed text-[#5f5c56]">{s.detail}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function StackSection() {
  return (
    <Section id="stack" tone="panel">
      <SectionHeader
        eyebrow="Technology"
        title="The stack, in groups."
        lede="Grouped by the job each piece does rather than dumped in one long list."
      />
      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {STACK.map((g) => (
          <li key={g.title} className="rounded-3xl border border-line bg-white p-6">
            <h3 className="font-display text-xl font-bold text-black-main">{g.title}</h3>
            <ul className="mt-4 flex flex-wrap gap-2">
              {g.items.map((i) => (
                <li
                  key={i}
                  className="rounded-full bg-panel-bg px-3 py-1.5 text-sm font-medium text-[#3d3b37]"
                >
                  {i}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function TimelineSection() {
  return (
    <Section id="timeline">
      <SectionHeader
        eyebrow="Timeline"
        title="How it came together."
        lede="Dates come from the project’s git history and the paper. Work before July 2026 is described by what the paper records, not by date."
      />
      <ol className="relative ml-3 space-y-8 border-l-2 border-line pl-8">
        {TIMELINE.map((m) => (
          <li key={m.title} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[2.6rem] top-1.5 h-4 w-4 rounded-full border-4 border-page-bg bg-crimson"
            />
            <p className="text-sm font-semibold text-crimson-dark">{m.when}</p>
            <h3 className="mt-1 font-display text-xl font-bold text-black-main">{m.title}</h3>
            <p className="mt-2 max-w-2xl text-base leading-relaxed text-[#3d3b37]">{m.detail}</p>
            <p className="mt-1 text-sm text-[#5f5c56]">Source: {m.source}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function ResourcesSection() {
  return (
    <Section id="resources" tone="dark">
      <SectionHeader
        invert
        eyebrow="Explore further"
        title="Check our work."
        lede="The code, history and documentation are public, so the claims on this site can be verified."
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <ButtonLink href={SITE.repoUrl} variant="accent">
          Source code
        </ButtonLink>
        <ButtonLink href={SITE.docsUrl} variant="onDark">
          Documentation
        </ButtonLink>
        <ButtonLink href={SITE.appUrl} variant="onDark">
          Live web app
        </ButtonLink>
        <ButtonLink href="/docs-addon" variant="onDark">
          Google Docs add-on
        </ButtonLink>
      </div>
    </Section>
  );
}
