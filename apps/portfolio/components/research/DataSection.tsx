import { CORPUS, TASK_DATASETS } from "@/content/research";
import { Section, SectionHeader } from "@/components/ui";
import { TOOL_ICONS } from "@/components/toolIcons";

const fmt = (n: number) => n.toLocaleString("en-US");

function Bar({
  label,
  value,
  max,
  tone = "bg-crimson",
}: {
  label: string;
  value: number;
  max: number;
  tone?: string;
}) {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-4 text-base">
        <span className="text-black-main">{label}</span>
        <span className="font-semibold tabular-nums text-black-main">
          {fmt(value)}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${label}: ${fmt(value)} articles`}
        className="h-3 overflow-hidden rounded-full bg-panel-bg"
      >
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DataSection() {
  return (
    <Section id="data">
      <SectionHeader
        eyebrow="The data"
        title="Over a million articles, filtered down to what is worth learning from."
        lede="Plain version: we collected Sinhala news, threw out the unusable third, and built four separate training sets, one per tool."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-line bg-white p-7 sm:p-9">
          <h3 className="font-display text-2xl font-bold text-black-main">
            From collected to kept
          </h3>
          <p className="mt-1 text-base text-[#5f5c56]">
            Articles from Sri Lankan Sinhala news sites, {CORPUS.span}.
          </p>
          <div className="mt-6 space-y-5">
            <Bar label="Collected" value={CORPUS.collected} max={CORPUS.collected} tone="bg-[#B5B1A6]" />
            <Bar label="Kept after filtering" value={CORPUS.kept} max={CORPUS.collected} />
          </div>
          <p className="mt-5 text-base text-[#5f5c56]">
            {fmt(CORPUS.removed)} articles ({CORPUS.removedPct}%) were removed.
          </p>
          <h4 className="mt-7 text-base font-semibold text-black-main">
            An article had to pass all of these
          </h4>
          <ul className="mt-3 space-y-2 text-base text-[#3d3b37]">
            {CORPUS.filters.map((f) => (
              <li key={f} className="flex gap-3">
                <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-crimson" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl border border-line bg-white p-7 sm:p-9">
          <h3 className="font-display text-2xl font-bold text-black-main">
            What the kept articles are about
          </h3>
          <p className="mt-1 text-base text-[#5f5c56]">
            The mix is very uneven, which matters later (see the headline test leak).
          </p>
          <div className="mt-6 space-y-4">
            {CORPUS.categories.map((c) => (
              <Bar key={c.name} label={c.name} value={c.count} max={CORPUS.categories[0].count} />
            ))}
          </div>
        </div>
      </div>

      <h3 className="mb-5 mt-14 font-display text-2xl font-bold text-black-main">
        Four training sets, one per tool
      </h3>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {TASK_DATASETS.map((d) => {
          const Icon = TOOL_ICONS[d.toolId];
          return (
            <li key={d.toolId} className="rounded-3xl border border-line bg-white p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdf3f2] text-crimson">
                <Icon aria-hidden="true" className="h-5 w-5" />
              </span>
              <p className="mt-4 text-base font-semibold text-black-main">{d.name}</p>
              <p className="mt-1 font-sans text-2xl font-bold tabular-nums text-black-main">{d.size}</p>
              <p className="mt-2 text-base text-[#5f5c56]">{d.structure}</p>
              {d.note && <p className="mt-2 text-sm text-[#5f5c56]">{d.note}</p>}
            </li>
          );
        })}
      </ul>
      <p className="mt-6 text-sm text-[#5f5c56]">Source: {CORPUS.source}.</p>
    </Section>
  );
}
