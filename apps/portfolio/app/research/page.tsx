import type { Metadata } from "next";
import { ProblemTeaser } from "@/components/home/problem-teaser";
import { ApproachStrip } from "@/components/home/approach-strip";
import { ResultsHighlight } from "@/components/home/results-highlight";
import { FooterCta } from "@/components/home/footer-cta";
import { TuckMascot } from "@/components/shell/tuck-mascot";

export const metadata: Metadata = {
  title: "Work",
  description:
    "The problem, the approach, and the measured results behind SinLlama's four Sinhala writing adapters.",
};

// Interim page: carries the relocated Home sections (problem/approach/results)
// until the fuch.ai-style build-timeline + scrollytelling redesign (ROADMAP
// Phase 2 / plan Phase E) lands.
export default function ResearchPage() {
  return (
    <div className="pt-24 sm:pt-28">
      <TuckMascot />
      <ProblemTeaser />
      <ApproachStrip />
      <ResultsHighlight />
      <FooterCta />
    </div>
  );
}
