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
    body: `Collected ${fmt(CORPUS.collected)} public news articles, removing noise and duplicates to yield ${fmt(CORPUS.kept)} high-quality training stories.`,
  },
  {
    icon: Layers3,
    title: "Adapt one shared base",
    body: "Fine-tuned dedicated LoRA adapters for each task, sharing a single robust Sinhala foundation model.",
  },
  {
    icon: FlaskConical,
    title: "Evaluate by task",
    body: "Benchmarked every tool with automated metrics, data leakage audits, and direct newsroom feedback.",
  },
  {
    icon: ShieldCheck,
    title: "Keep editorial control",
    body: "Built-in fact guards protect key dates, names, and quotes—keeping journalists in full editorial control.",
  },
];

export default function ProjectScope() {
  return (
    <>
      <Section id="project-scope" tone="panel">
        <SectionHeader
          eyebrow="Project scope"
          title="A Sinhala newsroom assistant built around four everyday writing tasks."
          lede="Sinhala journalists lack domain-specific AI writing tools. SinAI uses a shared language model to power a fast, practical editorial workflow."
        />

        <div className="grid gap-5 lg:grid-cols-3">
          {[
            {
              label: "Research problem",
              title: "Newsroom work is still heavily manual.",
              body: "Routine editorial tasks take hours, while generic AI models struggle with Sinhala grammar, idioms, and news tone.",
            },
            {
              label: "Research gap",
              title: "The four tasks are rarely studied as one reliable workflow.",
              body: "Most existing tools address isolated tasks. Newsrooms need an integrated workflow with clean training data, accurate facts, and reliable output.",
            },
            {
              label: "Proposed solution",
              title: "One foundation, four specialist adapters.",
              body: (
                <>
                  SinAI fine-tunes{" "}
                  <a
                    href={SINLLAMA.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold underline decoration-line underline-offset-4 hover:text-crimson"
                  >
                    {SINLLAMA.name}
                  </a>{" "}
                  into four dedicated writing tools, accessible in a web studio, Chrome extension, and Google Docs.
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
          lede="Four specialized tools that unite into a single writing workflow, each backed by its own clean dataset and rigorous tests."
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
          lede="A disciplined, data-first approach: clean large-scale news text, fine-tune lightweight model adapters, and verify with working journalists."
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
