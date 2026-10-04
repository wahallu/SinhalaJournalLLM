import { ArrowDown, Database, FlaskConical, Layers3, ShieldCheck } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui";
import { CORPUS } from "@/content/research";
import { TOOLS } from "@/content/tools";
import { SINLLAMA } from "@/content/site";

const fmt = (value: number) => value.toLocaleString("en-US");

const METHOD = [
  {
    icon: Database,
    title: "Collect and clean",
    body: `${fmt(CORPUS.collected)} public Sinhala news articles were collected. Exact duplicates and records that failed the documented quality filters were removed, leaving ${fmt(CORPUS.kept)} articles.`,
  },
  {
    icon: Layers3,
    title: "Adapt one shared base",
    body: "A separate LoRA adapter teaches each newsroom task while the same Sinhala language foundation is shared across the system.",
  },
  {
    icon: FlaskConical,
    title: "Evaluate by task",
    body: "Grammar, headlines, summaries, and style rewriting use task-specific automatic checks, leakage audits, and human feedback.",
  },
  {
    icon: ShieldCheck,
    title: "Keep editorial control",
    body: "Safety checks protect names, numbers, dates, and quotations. Generated text remains a suggestion for a journalist to review.",
  },
];

export default function ProjectScope() {
  return (
    <>
      <Section id="project-scope" tone="panel">
        <SectionHeader
          eyebrow="Project scope"
          title="A Sinhala newsroom assistant built around four everyday writing tasks."
          lede="Sinhala journalists have fewer domain-specific AI tools than high-resource newsrooms. SinAI studies whether one shared Sinhala base model can support a practical editorial workflow without hiding the limits of the evidence."
        />

        <div className="grid gap-5 lg:grid-cols-3">
          {[
            {
              label: "Research problem",
              title: "Newsroom work is still heavily manual.",
              body: "Grammar correction, headline writing, summarization, and style adaptation take time, while general multilingual systems often miss Sinhala morphology and journalistic context.",
            },
            {
              label: "Research gap",
              title: "The four tasks are rarely studied as one reliable workflow.",
              body: "Existing Sinhala work covers individual NLP tasks, but controlled newsroom generation still needs better data quality, task-specific adaptation, and evaluation that checks leakage and factual preservation.",
            },
            {
              label: "Proposed solution",
              title: "One foundation, four specialist adapters.",
              body: (
                <>
                  SinAI adapts{" "}
                  <a
                    href={SINLLAMA.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline decoration-line underline-offset-4 hover:text-crimson"
                  >
                    {SINLLAMA.name}
                  </a>{" "}
                  with separate LoRA adapters, then exposes them through a web workspace, Chrome extension, and Google Docs add-on.
                </>
              ),
            },
          ].map((item) => (
            <article key={item.label} className="rounded-3xl border border-line bg-white p-7 sm:p-8">
              <p className="text-sm font-semibold text-crimson">{item.label}</p>
              <h3 className="mt-3 font-display text-2xl font-bold leading-tight text-black-main">
                {item.title}
              </h3>
              <p className="mt-4 text-base leading-relaxed text-[#5f5c56]">{item.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section id="objectives">
        <SectionHeader
          eyebrow="Research objectives"
          title="Four components, each owned and evaluated as its own research task."
          lede="Together they form the writing workflow; separately they keep datasets, prompts, adapters, and evaluation evidence traceable."
        />
        <ol className="grid gap-5 sm:grid-cols-2">
          {TOOLS.map((tool, index) => (
            <li key={tool.id} className="rounded-3xl border border-line bg-white p-7 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <span className="font-sans text-sm font-bold tabular-nums text-crimson">
                  0{index + 1}
                </span>
                <ArrowDown aria-hidden="true" className="h-5 w-5 text-text-muted" />
              </div>
              <h3 className="mt-8 font-display text-2xl font-bold text-black-main">{tool.name}</h3>
              <p className="mt-3 text-base leading-relaxed text-[#5f5c56]">{tool.description}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="methodology" tone="dark">
        <SectionHeader
          invert
          eyebrow="Methodology"
          title="From public news data to evaluated newsroom tools."
          lede="The project follows a data-centric adaptation process: improve the corpus and targets, train a lightweight specialist, then check whether the measured gain is real."
        />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {METHOD.map(({ icon: Icon, title, body }, index) => (
            <article key={title} className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-crimson text-white">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="text-sm font-semibold tabular-nums text-white/40">0{index + 1}</span>
              </div>
              <h3 className="mt-6 font-display text-xl font-bold text-white">{title}</h3>
              <p className="mt-3 text-base leading-relaxed text-white/70">{body}</p>
            </article>
          ))}
        </div>
      </Section>
    </>
  );
}
