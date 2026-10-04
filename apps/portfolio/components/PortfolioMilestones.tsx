import { Check, CircleDot } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui";
import { TIMELINE } from "@/content/timeline";

export default function PortfolioMilestones() {
  return (
    <Section id="milestones" tone="panel">
      <SectionHeader
        eyebrow="Milestones"
        title="How the research moved from corpus building to a working product."
        lede="Dates are taken from the research paper, evaluation records, and repository history. Work that predates the repository is kept broad rather than assigned an invented day."
      />
      <ol className="relative ml-3 border-l border-line sm:ml-5">
        {TIMELINE.map((item, index) => (
          <li key={`${item.when}-${item.title}`} className="relative pb-10 pl-8 last:pb-0 sm:pl-12">
            <span className="absolute -left-[17px] top-0 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-white text-crimson">
              {index < TIMELINE.length - 1 ? <Check className="h-4 w-4" /> : <CircleDot className="h-4 w-4" />}
            </span>
            <article className="rounded-3xl border border-line bg-white p-6 sm:p-8">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-crimson">{item.when}</p>
                <p className="text-sm text-text-muted">Source: {item.source}</p>
              </div>
              <h3 className="mt-3 font-display text-2xl font-bold text-black-main">{item.title}</h3>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#5f5c56]">{item.detail}</p>
            </article>
          </li>
        ))}
      </ol>
    </Section>
  );
}
