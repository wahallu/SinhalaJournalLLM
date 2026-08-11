import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TrustStrip from "@/components/TrustStrip";
import VisualCollage from "@/components/VisualCollage";
import Manifesto from "@/components/Manifesto";
import ResearchShowcase from "@/components/ResearchShowcase";
import InteractivePlayground from "@/components/InteractivePlayground";
import EcosystemTabs from "@/components/EcosystemTabs";
import Benchmarks from "@/components/Benchmarks";
import Testimonials from "@/components/Testimonials";
import Updates from "@/components/Updates";
import CtaSection from "@/components/CtaSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAF9F5] text-[#1B1B1B]">
      {/* Floating Navigation Pill */}
      <Navbar />

      <main className="flex-1">
        {/* 1. Hero with Architectural Display Typography & Live Workspace Preview */}
        <Hero />

        {/* 2. Model & Ecosystem Marquee Trust Strip */}
        <TrustStrip />

        {/* 4. Manifesto Section with Celestial Geometric Vector Rings */}
        <Manifesto />

        {/* 5. Sinhala Journal LLM Foundation Model & Enterprise Architecture Deep Dive */}
        <ResearchShowcase />

        {/* 3. Floating Visual AI Collage (Sinhala Linguistic Intelligence) */}
        <VisualCollage />

        {/* 6. Live In-Page Interactive Tool Simulator (Grammar, Headlines, Style, Summary) */}
        <InteractivePlayground />

        {/* 7. Multi-Surface Ecosystem Suite (Web App, Chrome Ext, Docs Addon, FastAPI) */}
        <EcosystemTabs />

        {/* 8. Empirical Benchmarks & LoRA Adapter Version Registry */}
        <Benchmarks />

        {/* 9. Editorial Newsroom Endorsements */}
        <Testimonials />

        {/* 10. Research Publications & Release Updates */}
        <Updates />

        {/* 11. Final High-Impact Mega Call to Action */}
        <CtaSection />
      </main>

      {/* 12. Obsidian Black Editorial Footer */}
      <Footer />
    </div>
  );
}
