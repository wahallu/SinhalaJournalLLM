import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Surfaces from "@/components/Surfaces";
import Team from "@/components/Team";
import Footer from "@/components/Footer";
import ProjectScope from "@/components/ProjectScope";
import PortfolioMilestones from "@/components/PortfolioMilestones";
import DocumentLibrary from "@/components/DocumentLibrary";
import ResearchHighlights from "@/components/ResearchHighlights";
import ContactSection from "@/components/ContactSection";

/**
 * One-page research portfolio structure: overview, scope, objectives,
 * methodology, milestones, document library, outputs, team, and contact.
 * The deeper technical evidence remains available under /research.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-page-bg text-text-main">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <ProjectScope />
        <Surfaces />
        <PortfolioMilestones />
        <DocumentLibrary />
        <ResearchHighlights />
        <Team />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
