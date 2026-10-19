import type { Metadata } from "next";
import { ArrowRight, Check, X } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Container, Section, SectionHeader } from "@/components/ui";
import { TOOL_ICONS } from "@/components/toolIcons";
import { TOOL_BY_ID } from "@/content/tools";
import {
  ADOPTION_PRINCIPLES,
  ADVANTAGES,
  APPROACH,
  COMMERCIAL_SUMMARY,
  COMPONENT_GAPS,
  COST_CONTROL,
  COST_DRIVERS,
  CUSTOMER_PERSONA,
  IMPLEMENTED_PLANS,
  IMPLEMENTED_PLANS_NOTE,
  PROPOSED_PRICING,
  REVENUE_STREAMS,
  TARGET_MARKETS,
  VALUE_POINTS,
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
    "Literature survey, research gap, problem and solution, objectives, methodology and commercialization plan of the SinhalaJournal-LLM research project (R26-SE-037).",
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

        {/* Commercialization plan */}
        <Section id="commercialization">
          <SectionHeader title="Commercialization plan" />
          <p className="-mt-6 mb-12 max-w-3xl text-xl leading-relaxed text-[#3d3b37] sm:-mt-8 sm:text-2xl">
            {COMMERCIAL_SUMMARY}
          </p>

          <h3 className="mb-5 font-display text-2xl font-bold text-black-main">Target market</h3>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TARGET_MARKETS.map((m) => (
              <li
                key={m.segment}
                className={`rounded-3xl border p-6 ${m.primary ? "border-crimson/40 bg-crimson-tint" : "border-line bg-white"}`}
              >
                {m.primary && (
                  <span className="mb-3 inline-block rounded-full bg-crimson px-2.5 py-0.5 text-xs font-semibold text-white">
                    Primary
                  </span>
                )}
                <h4 className="font-display text-lg font-bold text-black-main">{m.segment}</h4>
                <p className="mt-2 text-base leading-relaxed text-[#5f5c56]">{m.detail}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-[#3d3b37]">
            <span className="font-semibold text-black-main">Customer persona: </span>
            {CUSTOMER_PERSONA}
          </p>

          <div className="mt-16 grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl border border-line bg-white p-7 sm:p-8">
              <h3 className="font-display text-2xl font-bold text-black-main">Value proposition</h3>
              <ul className="mt-6 space-y-4">
                {VALUE_POINTS.map((v) => (
                  <li key={v} className="flex gap-3 text-base leading-relaxed text-[#3d3b37]">
                    <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-crimson" />
                    {v}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-line bg-white p-7 sm:p-8">
              <h3 className="font-display text-2xl font-bold text-black-main">Revenue model</h3>
              <ul className="mt-6 grid gap-5 sm:grid-cols-2">
                {REVENUE_STREAMS.map((r) => (
                  <li key={r.title}>
                    <h4 className="text-base font-bold text-black-main">{r.title}</h4>
                    <p className="mt-1 text-base leading-relaxed text-[#5f5c56]">{r.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-16 grid gap-5 lg:grid-cols-2">
            <div className="rounded-3xl bg-black-main p-7 text-white sm:p-8">
              <h3 className="font-display text-2xl font-bold">Plans built into SinAi</h3>
              <ul className="mt-6 grid gap-3 sm:grid-cols-3">
                {IMPLEMENTED_PLANS.map((plan) => (
                  <li key={plan.name} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
                    <p className="text-lg font-bold">{plan.name}</p>
                    <p className="mt-1 text-sm text-white/75">{plan.quota}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm leading-relaxed text-white/70">{IMPLEMENTED_PLANS_NOTE}</p>
            </div>
            <div className="rounded-3xl border border-line bg-white p-7 sm:p-8">
              <h3 className="font-display text-2xl font-bold text-black-main">Proposed newsroom pricing</h3>
              <ul className="mt-6 grid gap-3 sm:grid-cols-3">
                {PROPOSED_PRICING.map((tier) => (
                  <li key={tier.tier} className="rounded-2xl border border-line p-4">
                    <p className="text-lg font-bold text-black-main">{tier.tier}</p>
                    <p className="mt-1 text-sm font-semibold text-crimson">{tier.price}</p>
                    <p className="mt-2 text-sm leading-relaxed text-[#5f5c56]">{tier.detail}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm leading-relaxed text-text-muted">
                Proposed in the March 2026 project proposal, with academic discounts and per-request API
                billing. Not a published price list.
              </p>
            </div>
          </div>

          <div className="mt-16 grid gap-5 lg:grid-cols-3">
            <div className="rounded-3xl border border-line bg-white p-7">
              <h3 className="font-display text-xl font-bold text-black-main">Cost structure</h3>
              <ul className="mt-5 space-y-3">
                {COST_DRIVERS.map((c) => (
                  <li key={c} className="flex gap-3 text-base leading-relaxed text-[#5f5c56]">
                    <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-crimson" />
                    {c}
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-line pt-5 text-sm leading-relaxed text-[#3d3b37]">{COST_CONTROL}</p>
            </div>
            <div className="rounded-3xl border border-line bg-white p-7">
              <h3 className="font-display text-xl font-bold text-black-main">Competitive advantage</h3>
              <ul className="mt-5 space-y-3">
                {ADVANTAGES.map((a) => (
                  <li key={a} className="flex gap-3 text-base leading-relaxed text-[#5f5c56]">
                    <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-crimson" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-line bg-white p-7">
              <h3 className="font-display text-xl font-bold text-black-main">Responsible adoption</h3>
              <ul className="mt-5 space-y-3">
                {ADOPTION_PRINCIPLES.map((a) => (
                  <li key={a} className="flex gap-3 text-base leading-relaxed text-[#5f5c56]">
                    <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-emerald-700" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-6 text-sm text-text-muted">
            From the proposal (March 2026) and the group thesis, chapter 7 (October 2026).
          </p>
        </Section>
      </main>
      <Footer />
    </div>
  );
}
