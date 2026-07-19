import { Hero } from "@/components/home/hero";
import { ProblemTeaser } from "@/components/home/problem-teaser";
import { ApproachStrip } from "@/components/home/approach-strip";
import { ResultsHighlight } from "@/components/home/results-highlight";
import { TeamTeaser } from "@/components/home/team-teaser";
import { PublicationsTeaser } from "@/components/home/publications-teaser";
import { FooterCta } from "@/components/home/footer-cta";

export default function Home() {
  return (
    <>
      <Hero />
      <ProblemTeaser />
      <ApproachStrip />
      <ResultsHighlight />
      <TeamTeaser />
      <PublicationsTeaser />
      <FooterCta />
    </>
  );
}
