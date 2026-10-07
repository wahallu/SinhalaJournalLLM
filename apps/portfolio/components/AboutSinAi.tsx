import { ArrowDown, Database, FlaskConical, Layers3 } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui";
import { TOOL_ICONS } from "@/components/toolIcons";
import { CORPUS } from "@/content/research";
import { EVAL_META } from "@/content/evaluation";
import { SINLLAMA } from "@/content/site";
import { TOOLS } from "@/content/tools";

const fmt = (value: number) => value.toLocaleString("en-US");

// How it was built: the old scope, objectives and methodology in three steps.
const STEPS = [
  {
    icon: Database,
    title: "Learned from the news",
    body: `${fmt(CORPUS.kept)} cleaned Sinhala news articles, kept from ${fmt(CORPUS.collected)} collected.`,
  },
  {
    icon: Layers3,
    title: "One model, four skills",
    body: "A shared Sinhala base model with one small adapter trained for each tool.",
  },
  {
    icon: FlaskConical,
    title: "Tested with journalists",
    body: `Benchmarked per task, then tried by ${EVAL_META.n} newsroom users in a small pilot.`,
  },
];

/** Grey placeholder lines for the illustrative draft; widths vary per line. */
const DRAFT_LINES = ["w-full", "w-11/12", "w-4/5", "w-full", "w-2/3"];

/** Animated dashed connector between the stages of the illustration. */
function Connector() {
  return (
    <div aria-hidden="true" className="flex items-center justify-center text-crimson">
      <ArrowDown className="h-6 w-6 lg:hidden" />
      <svg viewBox="0 0 80 12" className="hidden h-3 w-20 lg:block">
        <line
          x1="0"
          y1="6"
          x2="70"
          y2="6"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray="6 6"
          className="animate-[dash_1s_linear_infinite]"
        />
        <path d="M68 1 L78 6 L68 11" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    </div>
  );
}

/**
 * "What is SinAi?" — one sentence, then a picture of the idea: a Sinhala
 * draft goes into SinAi and comes back checked, titled, rewritten or
 * summarised. Replaces the separate scope, objectives and methodology
 * sections.
 */
export default function AboutSinAi() {
  return (
    <Section id="about" tone="panel">
      <SectionHeader title="What is SinAi?" />

      <p className="-mt-6 mb-14 max-w-3xl text-xl leading-relaxed text-[#3d3b37] sm:-mt-8 sm:text-2xl">
        An AI writing assistant for Sinhala newsrooms. Give it a news story
        and it checks the grammar, suggests headlines, rewrites it for another
        newspaper style or summarises it.
      </p>

      {/* Illustration: draft → SinAi → four results */}
      <figure className="rounded-[2rem] border border-line bg-white p-5 shadow-[0_24px_60px_-30px_rgba(27,27,27,0.25)] sm:p-8">
        <div className="grid items-center gap-6 lg:grid-cols-[1fr_auto_auto_auto_1.2fr] lg:gap-5">
          {/* Draft */}
          <div className="rounded-2xl border border-line bg-page-bg p-5">
            <p className="text-sm font-semibold text-[#5f5c56]">Your draft</p>
            <div className="mt-4 space-y-3">
              {DRAFT_LINES.map((w, i) => (
                <div key={i} className={`relative h-2.5 rounded-full bg-[#e2e0da] ${w}`}>
                  {(i === 1 || i === 3) && (
                    <span className="absolute left-[30%] top-full mt-0.5 h-[3px] w-1/4 rounded-full bg-[repeating-linear-gradient(90deg,#cd191a_0_4px,transparent_4px_7px)]" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <Connector />

          {/* Engine */}
          <div className="mx-auto flex flex-col items-center text-center">
            <div className="relative">
              <span
                aria-hidden="true"
                className="absolute inset-0 animate-ping rounded-[1.75rem] bg-crimson/20 [animation-duration:2.4s]"
              />
              <div className="relative flex h-32 w-32 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-[#e0201f] to-[#9d1213] shadow-[0_18px_40px_-12px_rgba(205,25,26,0.6)]">
                <span className="font-gwen text-4xl font-light text-white">SinAi</span>
              </div>
            </div>
            <p className="mt-4 max-w-[12rem] text-sm leading-snug text-[#5f5c56]">
              Built on{" "}
              <a
                href={SINLLAMA.url}
                target="_blank"
                rel="noopener noreferrer"
                title={SINLLAMA.citation}
                className="font-semibold text-black-main underline decoration-line underline-offset-4 hover:text-crimson"
              >
                {SINLLAMA.name}
              </a>{" "}
              with four task adapters
            </p>
          </div>

          <Connector />

          {/* Results */}
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {TOOLS.map((tool) => {
              const Icon = TOOL_ICONS[tool.id];
              return (
                <li
                  key={tool.id}
                  className="flex items-start gap-3 rounded-2xl border border-line bg-page-bg px-4 py-3"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-black-main text-white">
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block font-semibold text-black-main">{tool.name}</span>
                    <span className="block text-sm leading-snug text-[#5f5c56]">
                      {tool.tagline}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        <figcaption className="sr-only">
          A Sinhala news draft goes into SinAi, which returns grammar
          corrections, headlines, a restyled article or a summary.
        </figcaption>
      </figure>

      {/* How it was built */}
      <ol className="mt-10 grid gap-5 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="flex gap-4 rounded-3xl border border-line bg-white p-6">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-crimson text-white">
              <Icon aria-hidden="true" className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-black-main">
                <span className="mr-2 tabular-nums text-crimson">{i + 1}</span>
                {title}
              </h3>
              <p className="mt-1.5 text-base leading-relaxed text-[#5f5c56]">{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
