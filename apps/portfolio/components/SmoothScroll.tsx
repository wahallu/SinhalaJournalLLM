"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * Inertial smooth scrolling (Lenis). The wheel no longer jumps the page in
 * fixed steps; it eases towards the target, which is the "softer" scroll
 * most portfolio sites have. Lenis runs on GSAP's ticker so pinned and
 * scrubbed ScrollTrigger animations stay in step with it. Visitors who ask
 * for reduced motion keep the browser's native scrolling.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      // In-page links (/#team etc.) glide too, landing below the fixed header.
      anchors: { offset: -80 },
    });

    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return null;
}
