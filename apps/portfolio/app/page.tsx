import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import WhatIsIt from "@/components/WhatIsIt";
import ToolCards from "@/components/ToolCards";
import ExampleDemo from "@/components/ExampleDemo";
import Surfaces from "@/components/Surfaces";
import HowItWorks from "@/components/HowItWorks";
import Feedback from "@/components/Feedback";
import ResearchTeaser from "@/components/ResearchTeaser";
import Team from "@/components/Team";
import CtaSection from "@/components/CtaSection";
import Footer from "@/components/Footer";

/**
 * Homepage: the plain-language product story. Technical depth lives on
 * /research so this page stays quick to read. Section order follows how a
 * first-time visitor's questions arise: what is it, what does it do, show me,
 * where can I use it, how does it work, does it actually help, who made it.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-page-bg text-text-main">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <WhatIsIt />
        <ToolCards />
        <ExampleDemo />
        <Surfaces />
        <HowItWorks />
        <Feedback />
        <ResearchTeaser />
        <Team />
        <CtaSection />
      </main>
      <Footer />
    </div>
  );
}
