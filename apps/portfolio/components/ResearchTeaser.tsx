import { CORPUS } from "@/content/research";
import { ButtonLink, Section, SectionHeader } from "@/components/ui";
import { SITE } from "@/content/site";

const fmt = (n: number) => n.toLocaleString("en-US");

export default function ResearchTeaser() {
  const stats = [
    {
      value: `${fmt(CORPUS.collected)} → ${fmt(CORPUS.kept)}`,
      label: "Sinhala news articles collected, then kept after quality filtering",
    },
    {
      value: "4",
      label: "task-specific models built on one shared Sinhala language model",
    },
    {
      value: "2",
      label: "flaws in our own test sets found and fixed, and reported openly",
    },
  ];

  return (
    <Section id="research" tone="dark">
      <SectionHeader
        invert
        eyebrow="The research"
        title="Built on real research, including the parts that went wrong."
        lede="The technical write-up covers the data, the architecture and the mistakes we caught, such as a test score that looked twice as good as it really was."
      />
      <dl className="grid gap-5 md:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-3xl border border-white/10 bg-white/5 p-7"
          >
            <dt className="sr-only">{s.label}</dt>
            <dd>
              <span className="block font-sans text-3xl font-bold leading-tight tabular-nums text-white sm:text-4xl">
                {s.value}
              </span>
              <span className="mt-3 block text-base leading-relaxed text-white/75">
                {s.label}
              </span>
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/research" variant="accent">
          Read the research
        </ButtonLink>
        <ButtonLink href={SITE.repoUrl} variant="onDark">
          View the source code
        </ButtonLink>
      </div>
    </Section>
  );
}
