import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { RatingBar, RatingLegend } from "@/components/RatingBar";
import { TOOL_ICONS } from "@/components/toolIcons";
import { ButtonLink, Container, Section } from "@/components/ui";
import { ADAPTERS, CHALLENGES, RESULTS, TASK_DATASETS } from "@/content/research";
import { EVAL_META, byTool } from "@/content/evaluation";
import { SITE } from "@/content/site";
import { TEAM } from "@/content/team";
import { TOOL_BY_ID } from "@/content/tools";
import { TOOL_PAGES, type ToolPage } from "@/content/toolPages";

/**
 * One template for all four /research/<tool> pages, so they read the same and
 * every figure comes from content/research.ts and content/evaluation.ts.
 */
export function ToolDeepDive({ page }: { page: ToolPage }) {
  const tool = TOOL_BY_ID[page.toolId];
  const Icon = TOOL_ICONS[page.toolId];
  const adapter = ADAPTERS.find((a) => a.toolId === page.toolId);
  const dataset = TASK_DATASETS.find((d) => d.toolId === page.toolId);
  const results = RESULTS.filter((r) => r.toolId === page.toolId);
  const owner = TEAM.find((m) => m.toolId === page.toolId);
  const challenge = CHALLENGES[page.challenge];
  const statements = byTool(page.toolId);

  const idx = TOOL_PAGES.findIndex((p) => p.toolId === page.toolId);
  const next = TOOL_PAGES[(idx + 1) % TOOL_PAGES.length];

  return (
    <div className="flex min-h-screen flex-col bg-page-bg text-text-main">
      <Navbar />
      <main className="flex-1">
        <header className="relative overflow-hidden pb-14 pt-32 sm:pb-20 sm:pt-40">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[420px] w-[760px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#cd191a]/10 via-[#ff4b2b]/5 to-transparent blur-3xl"
          />
          <Container>
            <Link
              href="/research"
              className="inline-flex items-center gap-2 text-base font-medium text-[#5f5c56] transition-colors hover:text-crimson"
            >
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Research overview
            </Link>
            <div className="mt-6 flex items-center gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fdf3f2] text-crimson">
                <Icon aria-hidden="true" className="h-7 w-7" />
              </span>
              <p className="text-sm font-semibold text-crimson">Tool deep dive</p>
            </div>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.08] tracking-tight text-black-main sm:text-5xl lg:text-6xl">
              {page.title}
            </h1>
            <p className="mt-5 max-w-2xl text-xl leading-relaxed text-[#3d3b37]">
              {page.summary}
            </p>
            {owner && (
              <p className="mt-4 text-base text-[#5f5c56]">
                Built by <span className="font-semibold text-black-main">{owner.name}</span>
              </p>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={SITE.appUrl} variant="accent">
                Try the {tool.name.toLowerCase()}
              </ButtonLink>
              <ButtonLink href="/research" variant="secondary">
                All research
              </ButtonLink>
            </div>
          </Container>
        </header>

        <Section tone="panel">
          <h2 className="font-display text-3xl font-bold text-black-main sm:text-4xl">
            How it works
          </h2>
          <ul className="mt-8 grid gap-5 md:grid-cols-2">
            {page.howItWorks.map((h) => (
              <li key={h.title} className="rounded-3xl border border-line bg-page-bg p-7">
                <h3 className="font-display text-xl font-bold text-black-main">{h.title}</h3>
                <p className="mt-3 text-base leading-relaxed text-[#3d3b37]">{h.body}</p>
              </li>
            ))}
          </ul>

          {page.list && (
            <div className="mt-10 rounded-3xl border border-line bg-page-bg p-7 sm:p-9">
              <h3 className="font-display text-2xl font-bold text-black-main">
                {page.list.heading}
              </h3>
              {page.list.intro && (
                <p className="mt-1 text-base text-[#5f5c56]">{page.list.intro}</p>
              )}
              <ul className="mt-5 space-y-3">
                {page.list.items.map((i) => (
                  <li key={i.name} className="flex items-start gap-3 text-base text-[#3d3b37]">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-1 h-4 w-4 shrink-0 text-crimson"
                    />
                    <span>
                      <span className="font-semibold text-black-main">{i.name}</span>
                      {i.body && <> — {i.body}</>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>

        <Section>
          <h2 className="font-display text-3xl font-bold text-black-main sm:text-4xl">
            The model and its data
          </h2>
          <dl className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {adapter && (
              <>
                <Fact label="Evaluated adapter" value={adapter.version} />
                <Fact label="LoRA rank / alpha" value={adapter.rank} />
                <Fact label="Trainable parameters" value={adapter.trainableParams} />
                <Fact label="Training epochs" value={adapter.epochs} />
              </>
            )}
            {dataset && (
              <div className="rounded-3xl border border-line bg-white p-6 sm:col-span-2 lg:col-span-4">
                <dt className="text-sm font-semibold text-[#5f5c56]">Dataset</dt>
                <dd className="mt-1 text-lg text-black-main">
                  <span className="font-sans text-2xl font-bold tabular-nums">{dataset.size}</span>
                  <span className="text-[#5f5c56]">
                    {" "}
                    · {dataset.structure}
                    {dataset.note ? ` · ${dataset.note}` : ""}
                  </span>
                </dd>
              </div>
            )}
          </dl>
          <p className="mt-4 text-sm text-[#5f5c56]">
            These are the versions evaluated in the paper, not necessarily the
            versions running in the app today.
          </p>
        </Section>

        <Section tone="panel">
          <h2 className="font-display text-3xl font-bold text-black-main sm:text-4xl">
            Measured results
          </h2>
          <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {results.map((r) => (
              <li key={r.measure} className="flex flex-col rounded-3xl border border-line bg-page-bg p-6">
                <p className="font-sans text-3xl font-bold leading-tight tabular-nums text-black-main">{r.value}</p>
                <p className="mt-2 text-base font-medium text-black-main">{r.measure}</p>
                <p className="mt-3 text-sm text-[#5f5c56]">
                  <span className="font-semibold">Measured on:</span> {r.testSet}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[#5f5c56]">{r.caveat}</p>
              </li>
            ))}
          </ul>
        </Section>

        <Section tone="dark">
          <p className="text-sm font-semibold text-[#ff8a8a]">A lesson from this tool</p>
          <h2 className="mt-2 max-w-3xl font-display text-3xl font-bold text-white sm:text-4xl">
            {challenge.title}
          </h2>
          <p className="mt-3 text-lg text-white/80">{challenge.plain}</p>
          <dl className="mt-8 grid gap-6 md:grid-cols-3">
            {(
              [
                ["The problem", challenge.problem],
                ["What we found", challenge.found],
                ["What we did", challenge.fix],
              ] as const
            ).map(([label, text]) => (
              <div key={label} className="rounded-3xl border border-white/10 bg-white/5 p-6">
                <dt className="text-sm font-semibold text-white/60">{label}</dt>
                <dd className="mt-2 text-base leading-relaxed text-white/85">{text}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section>
          <h2 className="font-display text-3xl font-bold text-black-main sm:text-4xl">
            What testers said about it
          </h2>
          <p className="mt-3 max-w-2xl text-lg text-[#5f5c56]">
            {EVAL_META.n} people rated these statements from 1 to 5 in{" "}
            {EVAL_META.period}. It is a small, self-selected pilot.
          </p>
          <div className="mt-8 space-y-6 rounded-3xl border border-line bg-white p-7 sm:p-9">
            {statements.map((s) => (
              <RatingBar key={s.id} label={s.text} counts={s.counts} />
            ))}
            <div className="border-t border-line pt-4">
              <RatingLegend />
            </div>
          </div>
        </Section>

        <Section tone="panel">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-sm font-semibold text-[#5f5c56]">Next deep dive</p>
              <p className="mt-1 font-display text-2xl font-bold text-black-main">{next.title}</p>
            </div>
            <Link
              href={`/research/${next.slug}`}
              className="group inline-flex items-center gap-2 rounded-full bg-black-main px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-crimson focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson"
            >
              Read about the {next.title.toLowerCase()}
              <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </Section>
      </main>
      <Footer />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-line bg-white p-6">
      <dt className="text-sm font-semibold text-[#5f5c56]">{label}</dt>
      <dd className="mt-1 font-sans text-2xl font-bold tabular-nums text-black-main">{value}</dd>
    </div>
  );
}
