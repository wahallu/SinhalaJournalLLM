import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Surfaces from "@/components/Surfaces";
import Team from "@/components/Team";
import Footer from "@/components/Footer";
import AboutSinAi from "@/components/AboutSinAi";
import Technologies from "@/components/Technologies";
import PortfolioMilestones from "@/components/PortfolioMilestones";
import AiExpo from "@/components/AiExpo";
import DocumentLibrary from "@/components/DocumentLibrary";
import ResearchHighlights from "@/components/ResearchHighlights";
import ContactSection from "@/components/ContactSection";

/**
 * One-page research portfolio structure: hero, what SinAi is, products,
 * technologies, milestones, hackathon recognition, document library, outputs, team, and contact.
 * The deeper technical evidence remains available under /research.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-page-bg text-text-main">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <AboutSinAi />
        <Surfaces />
        <Technologies />
        <PortfolioMilestones />
        <AiExpo />
        <DocumentLibrary />
        <ResearchHighlights />
        <Team />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
