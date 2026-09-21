import {
  ADAPTERS,
  LIMITS,
  RESULTS,
  RESULTS_SOURCE,
  type ResultRow,
} from "@/content/research";
import {
  EVAL_META,
  RESPONDENT_FREQUENCY,
  RESPONDENT_ROLES,
  STATEMENTS,
  byTool,
  everyStatementHadALowRating,
  mean,
  type Statement,
} from "@/content/evaluation";
import { TOOLS } from "@/content/tools";
import { RatingBar, RatingLegend } from "@/components/RatingBar";
import { Section, SectionHeader } from "@/components/ui";
import { TOOL_ICONS } from "@/components/toolIcons";

// ── Results from the paper ─────────────────────────────────────────────────

export function ResultsSection() {
  return (
    <Section id="results">
      <SectionHeader
        eyebrow="Results"
        title="What the measurements say, and what they do not."
        lede="Every figure is from the research paper, shown with how many examples it was measured on and the paper’s own caveat. These describe the adapter versions evaluated there, which are not necessarily the versions running in the app today."
      />

      <div className="space-y-12">
        {TOOLS.map((tool) => {
          const rows = RESULTS.filter((r) => r.toolId === tool.id);
          const adapter = ADAPTERS.find((a) => a.toolId === tool.id);
          const Icon = TOOL_ICONS[tool.id];
          return (
            <div key={tool.id}>
              <div className="mb-5 flex flex-wrap items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdf3f2] text-crimson">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <h3 className="font-display text-2xl font-bold text-black-main">
                  {tool.name}
                </h3>
                {adapter && (
                  <span className="rounded-full bg-panel-bg px-3 py-1 text-sm font-medium text-[#3d3b37]">
                    Evaluated adapter {adapter.version} · {adapter.rank}
                  </span>
                )}
              </div>
              <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {rows.map((r) => (
                  <ResultCard key={r.measure} row={r} />
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-10 text-sm text-[#5f5c56]">Source: {RESULTS_SOURCE}.</p>
    </Section>
  );
}

function ResultCard({ row }: { row: ResultRow }) {
  return (
    <li className="flex flex-col rounded-3xl border border-line bg-white p-6">
      <p className="font-sans text-3xl font-bold leading-tight tabular-nums text-black-main">
        {row.value}
      </p>
      <p className="mt-2 text-base font-medium text-black-main">{row.measure}</p>
      <p className="mt-3 text-sm text-[#5f5c56]">
        <span className="font-semibold">Measured on:</span> {row.testSet}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#5f5c56]">{row.caveat}</p>
    </li>
  );
}

// ── Human evaluation ───────────────────────────────────────────────────────

const GROUPS: { id: Statement["tool"]; title: string }[] = [
  ...TOOLS.map((t) => ({ id: t.id, title: t.name })),
  { id: "overall", title: "The system overall" },
];

export function HumanEvaluationSection() {
  const sorted = [...STATEMENTS].sort(
    (a, b) => mean(a.counts) - mean(b.counts),
  );
  const lowest = sorted[0];
  const highest = sorted[sorted.length - 1];

  return (
    <Section id="human-evaluation" tone="panel">
      <SectionHeader
        eyebrow="Human evaluation"
        title={`How ${EVAL_META.n} people rated each tool`}
        lede={`After trying SinAi, respondents rated statements from ${EVAL_META.scale}. It was a Google Form completed between ${EVAL_META.period}. The sample is small and self-selected, so it shows early impressions rather than a controlled study.`}
      />

      <div className="mb-10 grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-line bg-page-bg p-6">
          <h3 className="text-base font-semibold text-black-main">Who took part</h3>
          <ul className="mt-3 space-y-1.5 text-base text-[#3d3b37]">
            {RESPONDENT_ROLES.map((r) => (
              <li key={r.label} className="flex justify-between gap-4">
                <span>{r.label}</span>
                <span className="font-semibold tabular-nums">{r.count}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-line bg-page-bg p-6">
          <h3 className="text-base font-semibold text-black-main">
            How often they work with Sinhala news
          </h3>
          <ul className="mt-3 space-y-1.5 text-base text-[#3d3b37]">
            {RESPONDENT_FREQUENCY.map((r) => (
              <li key={r.label} className="flex justify-between gap-4">
                <span>{r.label}</span>
                <span className="font-semibold tabular-nums">{r.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-8">
        {GROUPS.map((g) => (
          <div
            key={g.id}
            className="rounded-3xl border border-line bg-page-bg p-7 sm:p-9"
          >
            <h3 className="font-display text-2xl font-bold text-black-main">
              {g.title}
            </h3>
            <div className="mt-6 space-y-6">
              {byTool(g.id).map((s) => (
                <RatingBar key={s.id} label={s.text} counts={s.counts} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <RatingLegend />
      </div>

      <div className="mt-8 rounded-3xl border border-line bg-white p-7">
        <h3 className="font-display text-xl font-bold text-black-main">
          Reading these results honestly
        </h3>
        <ul className="mt-4 space-y-2.5 text-base leading-relaxed text-[#3d3b37]">
          <li>
            Highest average: “{highest.text}” at {mean(highest.counts).toFixed(1)}.
          </li>
          <li>
            Lowest average: “{lowest.text}” at {mean(lowest.counts).toFixed(1)}.
          </li>
          {everyStatementHadALowRating && (
            <li>
              Every statement received at least one rating of 3 or below, so
              not every tester was satisfied with every result.
            </li>
          )}
          <li>
            Thirteen responses cannot show statistical significance. Treat
            these as a signal about where to improve, not a benchmark.
          </li>
        </ul>
        <p className="mt-4 text-sm text-[#5f5c56]">
          Source: {EVAL_META.source}, {EVAL_META.period}.
        </p>
      </div>
    </Section>
  );
}

// ── Limits ─────────────────────────────────────────────────────────────────

export function LimitsSection() {
  return (
    <Section id="limits" tone="panel">
      <SectionHeader
        eyebrow="Limitations"
        title="What this evidence does not show."
        lede="A research project should say where its claims stop. These are ours."
      />
      <ul className="grid gap-4 md:grid-cols-2">
        {LIMITS.map((l) => (
          <li
            key={l}
            className="rounded-2xl border border-line bg-white p-6 text-base leading-relaxed text-[#3d3b37]"
          >
            {l}
          </li>
        ))}
      </ul>
    </Section>
  );
}
