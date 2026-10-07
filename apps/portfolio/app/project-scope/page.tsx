import type { Metadata } from "next";
import { ArrowRight, Check, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Container, Section, SectionHeader } from "@/components/ui";
import { TOOL_ICONS } from "@/components/toolIcons";
import { TOOL_BY_ID } from "@/content/tools";
import {
  APPROACH,
  COMPONENT_GAPS,
  GAP_SUMMARY,
  LITERATURE,
  MAIN_OBJECTIVE,
  METHOD_STEPS,
  OBJECTIVES,
  PROBLEM,
  SCOPE_SECTIONS,
  SOLUTION,
} from "@/content/projectScope";

export const metadata: Metadata = {
  title: "Project scope | SinAi",
  description:
    "Literature survey, research gap, problem and solution, objectives and methodology of the SinhalaJournal-LLM research project (R26-SE-037).",
};

const toolIds = Object.keys(COMPONENT_GAPS) as (keyof typeof COMPONENT_GAPS)[];

export default function ProjectScopePage() {
  return (
    <div className="flex min-h-screen flex-col bg-page-bg text-text-main">
      <Navbar />
      <main className="flex-1">
        {/* Page header */}
        <header data-nav-theme="dark" className="bg-[#0b0b0c] pb-16 pt-36 text-white sm:pb-20 sm:pt-44">
          <Container>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">Project scope</h1>
            <nav aria-label="Project scope sections" className="mt-10 flex flex-wrap gap-2">
              {SCOPE_SECTIONS.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/85 ring-1 ring-white/15 transition-colors hover:bg-white/15 hover:text-white"
                >
                  {s.label}
                </a>
              ))}
            </nav>
          </Container>
        </header>

        {/* Literature survey */}
        <Section id="literature-survey">
          <SectionHeader title="Literature survey" />
          <ul className="grid gap-5 md:grid-cols-2">
            {LITERATURE.map((s) => (
              <li key={s.work} className="flex flex-col rounded-3xl border border-line bg-white p-6 sm:p-7">
                <h3 className="font-display text-xl font-bold text-black-main">{s.work}</h3>
                <p className="mt-1 text-sm text-text-muted">{s.cite}</p>
                <p className="mt-4 flex gap-3 text-base leading-relaxed text-[#3d3b37]">
                  <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />
                  <span>
                    <span className="sr-only">Contribution: </span>
                    {s.found}
                  </span>
                </p>
                <p className="mt-2 flex gap-3 text-base leading-relaxed text-[#5f5c56]">
                  <X aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-crimson" />
                  <span>
                    <span className="sr-only">Limitation: </span>
                    {s.limit}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        </Section>

        {/* Research gap */}
        <Section id="research-gap" tone="panel">
          <SectionHeader title="Research gap" />
          <p className="-mt-6 mb-12 max-w-3xl text-xl leading-relaxed text-[#3d3b37] sm:-mt-8 sm:text-2xl">
            {GAP_SUMMARY}
          </p>
          <ul className="grid gap-5 sm:grid-cols-2">
            {toolIds.map((id) => {
              const Icon = TOOL_ICONS[id];
              return (
                <li key={id} className="rounded-3xl border border-line bg-white p-6 sm:p-7">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-black-main text-white">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <h3 className="font-display text-xl font-bold text-black-main">
                      {TOOL_BY_ID[id].name}
                    </h3>
                  </div>
                  <p className="mt-4 text-base leading-relaxed text-[#5f5c56]">{COMPONENT_GAPS[id]}</p>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* Problem and solution */}
        <Section id="problem-solution" tone="dark">
          <SectionHeader invert title="Research problem & solution" />
          <div className="grid items-stretch gap-5 lg:grid-cols-[1fr_auto_1fr]">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-8">
              <h3 className="font-display text-2xl font-bold text-white">The problem</h3>
              <ul className="mt-6 space-y-4">
                {PROBLEM.map((p) => (
                  <li key={p} className="flex gap-3 text-base leading-relaxed text-white/75">
                    <X aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-[#ff8a8a]" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div aria-hidden="true" className="flex items-center justify-center text-crimson">
              <ArrowRight className="h-8 w-8 rotate-90 lg:rotate-0" />
            </div>
            <div className="rounded-3xl bg-gradient-to-br from-[#cd191a] to-[#8d1213] p-7 sm:p-8">
              <h3 className="font-display text-2xl font-bold text-white">Our solution</h3>
              <ul className="mt-6 space-y-4">
                {SOLUTION.map((p) => (
                  <li key={p} className="flex gap-3 text-base leading-relaxed text-white/90">
                    <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-white" />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Section>

        {/* Objectives */}
        <Section id="objectives">
          <SectionHeader title="Research objectives" />
          <p className="-mt-6 mb-12 max-w-3xl text-xl leading-relaxed text-[#3d3b37] sm:-mt-8 sm:text-2xl">
            {MAIN_OBJECTIVE}
          </p>
          <ol className="grid gap-5 lg:grid-cols-2">
            {OBJECTIVES.map((o, i) => {
              const Icon = TOOL_ICONS[o.tool];
              return (
                <li key={o.tool} className="rounded-3xl border border-line bg-white p-7 sm:p-8">
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-crimson text-white">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </span>
                    <span className="text-sm font-bold tabular-nums text-crimson">0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 font-display text-2xl font-bold text-black-main">
                    {TOOL_BY_ID[o.tool].name}
                  </h3>
                  <p className="mt-1 text-sm text-text-muted">{o.owner}</p>
                  <p className="mt-4 text-base leading-relaxed text-[#3d3b37]">{o.objective}</p>
                  <ul className="mt-5 space-y-2 border-t border-line pt-5">
                    {o.sub.map((s) => (
                      <li key={s} className="flex gap-3 text-base text-[#5f5c56]">
                        <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-crimson" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
          <p className="mt-6 text-sm text-text-muted">
            Objectives as set in the proposal presentation, 16 March 2026.
          </p>
        </Section>

        {/* Methodology */}
        <Section id="methodology" tone="panel">
          <SectionHeader title="Methodology" />
          <p className="-mt-6 mb-12 max-w-3xl text-xl leading-relaxed text-[#3d3b37] sm:-mt-8 sm:text-2xl">
            {APPROACH}
          </p>
          <ol className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {METHOD_STEPS.map((step, i) => (
              <li key={step.title} className="rounded-3xl border border-line bg-white p-6 sm:p-7">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black-main text-sm font-bold tabular-nums text-white">
                  {i + 1}
                </span>
                <h3 className="mt-5 font-display text-xl font-bold text-black-main">{step.title}</h3>
                <p className="mt-2 text-base leading-relaxed text-[#5f5c56]">{step.body}</p>
              </li>
            ))}
          </ol>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
