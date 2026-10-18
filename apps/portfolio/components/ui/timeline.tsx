"use client";

import {
  type CSSProperties,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { STORYLINE, STORYLINE_PERIOD, type StoryItem } from "@/content/timeline";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// SSR-safe layout effect to avoid React warnings during Next.js server render
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type JourneyItem = StoryItem;

export type TimelineProps = {
  title?: string;
  periodLabel?: string;
  textColor?: string;
  mutedTextColor?: string;
  activeColor?: string;
  backgroundColor?: string;
  imageUrl?: string;
  imageAlt?: string;
  /** Milestones in date order. They alternate above and below the spine. */
  items?: JourneyItem[];
  /** Reveal animation duration for each milestone, in seconds. */
  duration?: number;
};

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(callback: () => void) {
  if (typeof window === "undefined") return () => {};

  const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);
  mediaQueryList.addEventListener("change", callback);

  return () => mediaQueryList.removeEventListener("change", callback);
}

function getReducedMotionSnapshot() {
  if (typeof window === "undefined") return false;

  return window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ?? false;
}

function getServerReducedMotionSnapshot() {
  return false;
}

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );
}

/**
 * Pinned horizontal storyline. Scrolling down slides the track sideways;
 * each milestone draws its stem and fades in as it enters the viewport, so
 * they appear strictly in date order. The spine fills in step with them.
 */
export default function Timeline({
  title = "Project storyline",
  periodLabel = STORYLINE_PERIOD,
  textColor = "#FAF9F5",
  mutedTextColor = "#A39E93",
  activeColor = "#cd191a",
  backgroundColor = "#141414",
  imageUrl = "/assets/sinai-poster.png",
  imageAlt = "SinAi, powered by SinhalaJournal-LLM",
  items = STORYLINE,
  duration = 0.9,
}: TimelineProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const d = Math.max(0.2, duration);

  useIsomorphicLayoutEffect(() => {
    const pinEl = pinRef.current;
    const track = trackRef.current;
    if (!pinEl || !track) return;

    const ctx = gsap.context(() => {
      const distance = () =>
        Math.max(0, track.scrollWidth - document.documentElement.clientWidth);

      // Horizontal slide, driven by vertical scroll while the section is pinned.
      const slide = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: pinEl,
          pin: true,
          start: "top top",
          // Scroll 1.4px per px of travel so each milestone has time to land.
          end: () => `+=${distance() * 1.4}`,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });

      if (reducedMotion) return;

      gsap.fromTo(
        ".js-spine-progress",
        { scaleX: 0 },
        {
          scaleX: 1,
          ease: "none",
          scrollTrigger: {
            trigger: ".js-spine",
            containerAnimation: slide,
            start: "left 75%",
            end: "right 75%",
            scrub: true,
          },
        },
      );

      gsap.utils.toArray<HTMLElement>(".js-milestone").forEach((el) => {
        const tl = gsap.timeline({
          defaults: { ease: "power3.out" },
          scrollTrigger: {
            trigger: el,
            containerAnimation: slide,
            start: "left 80%",
            toggleActions: "play none none reverse",
          },
        });
        tl.from(el.querySelector(".js-node"), { scale: 0, duration: d * 0.4 })
          .from(el.querySelector(".js-stem"), { scaleY: 0, duration: d * 0.6 }, "<")
          .from(el.querySelector(".js-dot"), { scale: 0, duration: d * 0.35 }, "-=0.15")
          .from(
            el.querySelectorAll(".js-copy > *"),
            { opacity: 0, y: 24, duration: d, stagger: 0.08 },
            "-=0.2",
          );
      });
    }, sectionRef);

    // Web fonts change the track width; re-measure once they are in.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    return () => ctx.revert();
  }, [reducedMotion, d, items]);

  const accent: CSSProperties = { backgroundColor: activeColor };
  const muted: CSSProperties = { color: mutedTextColor };

  return (
    <section
      ref={sectionRef}
      data-nav-theme="dark"
      className="relative w-full overflow-hidden"
      style={{ color: textColor, backgroundColor }}
    >
      <div ref={pinRef} className="flex h-screen items-center pt-[72px]">
        <div
          ref={trackRef}
          className="flex h-[min(70vh,620px)] w-max items-stretch gap-[clamp(28px,4vw,72px)] pl-[clamp(20px,5vw,80px)] pr-[clamp(48px,10vw,160px)] [--col:clamp(300px,30vw,440px)] max-[600px]:[--col:80vw]"
        >
          {/* Poster */}
          <div className="relative aspect-[2/3] h-full shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-2xl max-[600px]:h-[62%] max-[600px]:self-center">
            <img
              src={imageUrl}
              alt={imageAlt}
              width={1024}
              height={1536}
              draggable={false}
              className="h-full w-full object-cover"
            />
          </div>

          {/* Title and period */}
          <div className="flex h-full w-[clamp(200px,20vw,300px)] shrink-0 flex-col justify-between py-2 max-[600px]:w-[64vw]">
            <h2 className="font-display text-[clamp(2rem,3.4vw,3.5rem)] font-bold leading-[1.02] tracking-tight">
              {title}
            </h2>
            <p className="font-mono text-sm tracking-wider sm:text-base" style={muted}>
              {periodLabel}
            </p>
          </div>

          {/* Milestones on a spine */}
          <div className="js-spine relative h-full shrink-0">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/15"
            />
            <div
              aria-hidden="true"
              className="js-spine-progress absolute inset-x-0 top-1/2 h-[2px] origin-left -translate-y-1/2 rounded-full"
              style={accent}
            />

            <ol className="relative flex h-full">
            {items.map((item, i) => {
              const top = i % 2 === 0;
              return (
                <li
                  key={item.id}
                  className="js-milestone relative h-full w-[var(--col)] shrink-0"
                  style={i ? { marginLeft: "calc(var(--col) / -2)" } : undefined}
                >
                  {/* Node on the spine */}
                  <span
                    aria-hidden="true"
                    className="js-node absolute left-0 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={accent}
                  />
                  {/* Stem from the spine to the milestone */}
                  <span
                    aria-hidden="true"
                    className={`js-stem absolute left-0 w-px ${top ? "bottom-1/2 top-[6%] origin-bottom" : "bottom-[6%] top-1/2 origin-top"}`}
                    style={accent}
                  />
                  <span
                    aria-hidden="true"
                    className={`js-dot absolute left-0 size-3.5 -translate-x-1/2 rounded-full ring-4 ring-[color:var(--ring)] ${top ? "top-[6%] -translate-y-1/2" : "bottom-[6%] translate-y-1/2"}`}
                    style={{ ...accent, ["--ring" as string]: `${activeColor}33` }}
                  />

                  <div
                    className={`js-copy absolute left-0 w-[92%] pl-6 ${top ? "top-[6%] -mt-3" : "bottom-[6%] -mb-3"}`}
                  >
                    <p
                      className="inline-block rounded-full px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider sm:text-sm"
                      style={{ backgroundColor: `${activeColor}24`, color: activeColor }}
                    >
                      {item.when}
                    </p>
                    <h3 className="mt-3 font-display text-xl font-bold leading-tight sm:text-2xl">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed sm:text-base" style={muted}>
                      {item.content}
                    </p>
                  </div>
                </li>
              );
            })}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
