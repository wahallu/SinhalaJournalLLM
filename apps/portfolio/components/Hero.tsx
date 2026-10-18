"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { SITE } from "@/content/site";

// Background artwork from the hero design (21st.dev responsive hero banner),
// self-hosted so the hero does not depend on their CDN.
const BACKGROUND = "/assets/hero-bg.jpg";

/**
 * Full-screen homepage hero: two-line title, description and two actions.
 * Marked dark so the fixed header switches to its light-on-dark colours
 * while it sits over it.
 *
 * Parallax: as the page scrolls, the artwork drifts down at a fraction of
 * the scroll speed while the text rises and fades, so the two layers seem
 * to sit at different depths.
 */
export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLImageElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.registerPlugin(ScrollTrigger);
    const ctx = gsap.context(() => {
      const scrub = {
        trigger: sectionRef.current,
        start: "top top",
        end: "bottom top",
        scrub: true,
      };
      gsap.to(bgRef.current, { yPercent: 30, ease: "none", scrollTrigger: scrub });
      gsap.to(contentRef.current, {
        yPercent: -40,
        opacity: 0,
        ease: "none",
        scrollTrigger: { ...scrub, end: "80% top" },
      });
    }, sectionRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero"
      data-nav-theme="dark"
      className="relative isolate flex min-h-screen w-full items-center overflow-hidden bg-black text-white"
    >
      <img
        ref={bgRef}
        src={BACKGROUND}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-10 h-full w-full object-cover will-change-transform"
      />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-black/30" />

      {/* Sits a little below centre: the extra top padding pushes it down. */}
      <div
        ref={contentRef}
        className="mx-auto w-full max-w-7xl px-6 pb-12 pt-[28vh] sm:pt-[30vh]"
      >
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="animate-fade-slide-in-1 font-sans text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
            <span className="sm:block">AI Writing Assistant</span>{" "}
            <span className="sm:block">for Sinhala Journalism</span>
          </h1>

          <p className="animate-fade-slide-in-2 mx-auto mt-6 max-w-2xl text-base text-white/80 sm:text-lg">
            First unified Sinhala journalism focused AI system that helps
            journalists prepare news content faster and better.
          </p>

          <div className="animate-fade-slide-in-3 mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <a
              href={SITE.appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-white ring-1 ring-white/15 transition-colors hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Try now
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </a>
            <Link
              href="/research"
              className="inline-flex items-center gap-2 rounded-full bg-transparent px-5 py-3 text-sm font-medium text-white/90 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Explore the research
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
