import { ArrowUpRight, BookOpen, Code2, MonitorCheck } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui";
import { SITE } from "@/content/site";

const HIGHLIGHTS = [
  {
    icon: BookOpen,
    title: "Research paper completed",
    body: "The six-page paper reports the corpus pipeline, four task adapters, data leakage audits, automatic evaluation, and a 13-participant field study.",
    href: "/documents/sinhalajournal-llm-research-paper.pdf",
    label: "Read the paper",
  },
  {
    icon: MonitorCheck,
    title: "Three working client surfaces",
    body: "The same backend supports the SinAI web workspace, a Chrome extension, and a Google Docs add-on for newsroom writing.",
    href: SITE.appUrl,
    label: "Open the workspace",
  },
  {
    icon: Code2,
    title: "Reproducible engineering record",
    body: "Source code, configuration, tests, model-serving notes, and research documentation are maintained together in the project repository.",
    href: SITE.repoUrl,
    label: "Browse the repository",
  },
];

export default function ResearchHighlights() {
  return (
    <Section id="achievements" tone="dark">
      <SectionHeader
        invert
        eyebrow="Research outputs"
        title="Evidence, software, and documentation - not a showcase of unsupported claims."
        lede="These are concrete outputs visible in the supplied documents and repository. Conference acceptance or awards are not claimed without supporting evidence."
      />
      <div className="grid gap-5 lg:grid-cols-3">
        {HIGHLIGHTS.map(({ icon: Icon, title, body, href, label }) => (
          <article key={title} className="flex flex-col rounded-3xl border border-white/10 bg-white/5 p-7">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-crimson text-white">
              <Icon aria-hidden="true" className="h-6 w-6" />
            </span>
            <h3 className="mt-6 font-display text-2xl font-bold text-white">{title}</h3>
            <p className="mt-3 text-base leading-relaxed text-white/70">{body}</p>
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-[#ff8a8a]"
            >
              {label} <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </article>
        ))}
      </div>
    </Section>
  );
}
