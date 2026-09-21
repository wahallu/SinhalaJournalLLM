import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { ButtonLink, Container } from "@/components/ui";
import { SITE } from "@/content/site";
import { TOOLS } from "@/content/tools";
import { DataSection } from "@/components/research/DataSection";
import { ArchitectureSection } from "@/components/research/ArchitectureDiagram";
import {
  ChallengesSection,
  EngineSection,
} from "@/components/research/EngineChallenges";
import {
  HumanEvaluationSection,
  LimitsSection,
  ResultsSection,
} from "@/components/research/Evidence";
import {
  ResourcesSection,
  SecuritySection,
  StackSection,
  TimelineSection,
} from "@/components/research/Build";

export const metadata: Metadata = {
  title: "Research and engineering | SinAI Document Assistant",
  description:
    "How SinAI Document Assistant was built: the Sinhala news corpus, the architecture, the engineering problems we found and fixed, measured results and a 13-person user evaluation.",
};

const JUMP = [
  ["The data", "#data"],
  ["Architecture", "#architecture"],
  ["AI engine", "#engine"],
  ["Challenges", "#challenges"],
  ["Results", "#results"],
  ["User evaluation", "#human-evaluation"],
  ["Security", "#security"],
  ["Stack", "#stack"],
  ["Timeline", "#timeline"],
] as const;

export default function ResearchPage() {
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
            <p className="text-sm font-semibold text-crimson">
              Research and engineering
            </p>
            <h1 className="mt-3 max-w-4xl font-display text-4xl font-bold leading-[1.08] tracking-tight text-black-main text-balance sm:text-5xl lg:text-6xl">
              How SinAi was built, and what the evidence says.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[#5f5c56]">
              This is the technical side of {SITE.name}, the{" "}
              {SITE.researchTitle} research project. Each section starts with a
              plain-language summary, then goes into detail. It includes the
              mistakes we caught along the way.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={SITE.repoUrl} variant="primary">
                Source code
              </ButtonLink>
              <ButtonLink href={SITE.appUrl} variant="secondary">
                Try the app
              </ButtonLink>
            </div>

            <nav aria-label="On this page" className="mt-12">
              <p className="mb-3 text-sm font-semibold text-[#5f5c56]">
                Jump to
              </p>
              <ul className="flex flex-wrap gap-2">
                {JUMP.map(([label, href]) => (
                  <li key={href}>
                    <a
                      href={href}
                      className="inline-block rounded-full border border-line bg-white px-4 py-2 text-base font-medium text-[#3d3b37] transition-colors hover:border-black-main focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson"
                    >
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="mt-10 border-t border-line pt-6">
              <p className="mb-3 text-sm font-semibold text-[#5f5c56]">
                Deep dives by tool
              </p>
              <ul className="flex flex-wrap gap-x-6 gap-y-2 text-base">
                {TOOLS.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={t.href}
                      className="font-semibold text-black-main underline decoration-line underline-offset-4 hover:text-crimson hover:decoration-crimson"
                    >
                      {t.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </header>

        <DataSection />
        <ArchitectureSection />
        <EngineSection />
        <ChallengesSection />
        <ResultsSection />
        <HumanEvaluationSection />
        <SecuritySection />
        <StackSection />
        <TimelineSection />
        <LimitsSection />
        <ResourcesSection />
      </main>
      <Footer />
    </div>
  );
}
