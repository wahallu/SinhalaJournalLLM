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
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger, SplitText);
}

// SSR-safe layout effect to avoid React warnings during Next.js server render
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

/* Inline stand-in for @gsap/react's useGSAP. Mirrors its default
   `revertOnUpdate: false`: one gsap.context lives for the component's
   lifetime, the callback is re-added when dependencies change, and the
   context is reverted only on unmount. A callback may return its own
   cleanup, which runs before the next re-add and on unmount. */
function useGSAP(
  callback: () => void | (() => void),
  options?: {
    dependencies?: unknown[];
    scope?: { current: Element | null } | Element | null;
  }
) {
  const deps = options?.dependencies ?? [];
  const scope = options?.scope;
  const ctxRef = useRef<gsap.Context | null>(null);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  useIsomorphicLayoutEffect(() => {
    const el =
      scope && typeof scope === "object" && "current" in scope
        ? scope.current
        : (scope as Element | null);
    ctxRef.current = gsap.context(() => {}, el ?? undefined);
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = undefined;
      ctxRef.current?.revert();
      ctxRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useIsomorphicLayoutEffect(() => {
    if (!ctxRef.current) return;
    cleanupRef.current?.();
    const ret = ctxRef.current.add(callback);
    cleanupRef.current = typeof ret === "function" ? ret : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

const monthOrder = {
  January: 1,
  February: 2,
  March: 3,
  April: 4,
  May: 5,
  June: 6,
  July: 7,
  August: 8,
  September: 9,
  October: 10,
  November: 11,
  December: 12,
} as const;

export type Month = keyof typeof monthOrder | string;

export type JourneyItem = {
  id: string;
  year: string;
  month: Month;
  when?: string;
  title: string;
  content: string;
  source?: string;
};

type SplitTextInstance = InstanceType<typeof SplitText>;

export type TimelineProps = {
  title?: string;
  periodLabel?: string;
  textColor?: string;
  mutedTextColor?: string;
  activeColor?: string;
  backgroundColor?: string;
  imageUrl?: string;
  imageAlt?: string;
  topItems?: JourneyItem[];
  bottomItems?: JourneyItem[];
  items?: JourneyItem[];
  /** Reveal animation duration, in seconds. */
  duration?: number;
  /** Fallback reveal duration when `duration` is omitted, in seconds. */
  scrollDuration?: number;
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

export const defaultTopJourneyData: JourneyItem[] = [
  {
    id: "2026-march-corpus",
    year: "2026",
    month: "March",
    when: "Up to March 2026",
    title: "Building the News Corpus",
    content:
      "Collected 884,193 Sinhala news articles and filtered down to the 665,887-article corpus used for task datasets.",
    source: "Research Paper",
  },
  {
    id: "2026-july-gateway",
    year: "2026",
    month: "July",
    when: "18 July 2026",
    title: "Resilient Model Gateway",
    content:
      "Three-tier fallback keeps editorial tools alive during GPU downtime, paired with a unified history feed.",
    source: "git log",
  },
  {
    id: "2026-aug-eval",
    year: "2026",
    month: "August",
    when: "27–31 August 2026",
    title: "Newsroom User Evaluation",
    content:
      "Thirteen Sinhala editors, journalism students, and teachers trialed and rated all headline & summarizer tools.",
    source: "Evaluation Form",
  },
];

export const defaultBottomJourneyData: JourneyItem[] = [
  {
    id: "2026-july-clients",
    year: "2026",
    month: "July",
    when: "1–2 July 2026",
    title: "Architecture & First Clients",
    content:
      "Loosely coupled backend, Supabase DB, followed by the Chrome extension and Google Docs add-on.",
    source: "git log",
  },
  {
    id: "2026-aug-admin",
    year: "2026",
    month: "August",
    when: "1–3 August 2026",
    title: "Accounts, History & Admin",
    content:
      "Per-user history under row-level security, admin dashboard with feature toggles, and self-hosted auth.",
    source: "git log",
  },
  {
    id: "2026-sept-polish",
    year: "2026",
    month: "September",
    when: "16–17 September 2026",
    title: "Plans & Interface Polish",
    content:
      "Tiered usage tracking and Sinhala/English bilingual toggle, refining the system for public release.",
    source: "git log",
  },
];

export default function Timeline({
  title = "Research Milestones",
  periodLabel = "March — Sept 2026",
  textColor = "#FAF9F5",
  mutedTextColor = "#A39E93",
  activeColor = "#cd191a",
  backgroundColor = "#141414",
  imageUrl = "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?q=80&w=1200&auto=format&fit=crop",
  imageAlt = "Sinhala journalistic news corpus and research archive",
  topItems,
  bottomItems,
  items,
  duration,
  scrollDuration = 1.2,
}: TimelineProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const wholeSliderRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const animationDuration = duration ?? scrollDuration;
  const normalizedDuration = Math.max(0.2, animationDuration);

  const resolvedTopItems =
    topItems ??
    (items ? items.filter((_, i) => i % 2 === 0) : defaultTopJourneyData);
  const resolvedBottomItems =
    bottomItems ??
    (items ? items.filter((_, i) => i % 2 === 1) : defaultBottomJourneyData);

  const allJourneyItems: JourneyItem[] = [
    ...resolvedTopItems,
    ...resolvedBottomItems,
  ].sort((a, b) => {
    const yearDiff = Number(a.year) - Number(b.year);
    if (yearDiff !== 0) return yearDiff;
    const mA = monthOrder[a.month as keyof typeof monthOrder] ?? 0;
    const mB = monthOrder[b.month as keyof typeof monthOrder] ?? 0;
    return mA - mB;
  });

  const sectionStyle: CSSProperties = {
    color: textColor,
    backgroundColor,
  };
  const activeStyle: CSSProperties = {
    backgroundColor: activeColor,
  };
  const mutedTextStyle: CSSProperties = {
    color: mutedTextColor,
  };

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const isMobile = window.innerWidth < 600;
      const slidePercent = isMobile ? -58 : -62;
      const lineWidth = isMobile ? "70%" : "98%";
      const lineStart = isMobile ? "top 30%" : "top 25%";
      const slideEnd = isMobile ? "82% 50%" : "92% bottom";
      const lineEnd = isMobile ? "80% 50%" : "92% bottom";

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: "top top",
          end: slideEnd,
          scrub: true,
        },
        defaults: {
          ease: "none",
        },
      });

      tl.fromTo(
        wholeSliderRef.current,
        { xPercent: 0 },
        { xPercent: slidePercent },
      );

      if (reducedMotion) {
        gsap.set(".journey-line", { width: lineWidth });
        return;
      }

      gsap.to(".journey-line", {
        width: lineWidth,
        ease: "none",
        scrollTrigger: {
          trigger: section,
          start: lineStart,
          end: lineEnd,
          scrub: true,
        },
      });
    },
    { dependencies: [reducedMotion], scope: sectionRef }
  );

  useGSAP(
    () => {
      const section = sectionRef.current;
      if (!section) return;

      const currentItems = allJourneyItems;

      if (reducedMotion) {
        currentItems.forEach((item) => {
          gsap.set(`.jl-${item.id}`, { scaleY: 1 });
          gsap.set(`.jd-${item.id}`, { scale: 1 });
          gsap.set(`.title-${item.id}`, { opacity: 1, clearProps: "transform" });
          gsap.set(`.description-${item.id}`, {
            opacity: 1,
            clearProps: "transform",
          });
        });
        return;
      }

      currentItems.forEach((item) => {
        gsap.set(`.jl-${item.id}`, {
          scaleY: 0,
          transformOrigin: "bottom bottom",
        });
        gsap.set(`.jd-${item.id}`, { scale: 0 });
        gsap.set(`.title-${item.id}`, { opacity: 1 });
        gsap.set(`.description-${item.id}`, { opacity: 1 });
      });

      const titleSplits: Partial<Record<string, SplitTextInstance>> = {};
      const descriptionSplits: Partial<Record<string, SplitTextInstance>> = {};

      currentItems.forEach((item) => {
        try {
          const titleEl = section.querySelector(`.title-${item.id}`);
          if (titleEl) {
            titleSplits[item.id] = new SplitText(titleEl, {
              type: "chars, words, lines",
            });
          }

          const descEl = section.querySelector(`.description-${item.id}`);
          if (descEl) {
            descriptionSplits[item.id] = new SplitText(descEl, {
              type: "chars, words, lines",
            });
          }
        } catch (e) {
          // Graceful fallback if SplitText meets DOM anomalies
        }
      });

      const createItemTimeline = (
        item: JourneyItem,
        startPos: number,
        endPos: number
      ) => {
        const lineSelector = `.jl-${item.id}`;
        const dotSelector = `.jd-${item.id}`;
        const titleLines = titleSplits[item.id]?.lines ?? [];
        const descriptionLines = descriptionSplits[item.id]?.lines ?? [];

        const isTop = resolvedTopItems.some((topItem) => topItem.id === item.id);

        if (!isTop) {
          gsap.set(lineSelector, { transformOrigin: "top top" });
        }

        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: `${startPos}% 30%`,
            end: `${endPos}% 50%`,
            scrub: true,
          },
        });

        timeline
          .to(lineSelector, {
            scaleY: 1,
            duration: normalizedDuration * 0.4,
          })
          .to(
            dotSelector,
            {
              scale: 1,
              duration: normalizedDuration * 0.4,
            },
            "<"
          );

        if (titleLines.length > 0) {
          timeline.fromTo(
            titleLines,
            { y: 50, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              delay: -0.8 * normalizedDuration,
              duration: normalizedDuration,
              stagger: 0.02,
              ease: "power2.out",
            }
          );
        }

        if (descriptionLines.length > 0) {
          timeline.fromTo(
            descriptionLines,
            { y: 35, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: normalizedDuration,
              stagger: 0.02,
              ease: "power2.out",
            },
            "<"
          );
        }

        return timeline;
      };

      const isMobile = window.innerWidth < 600;
      const count = currentItems.length;

      currentItems.forEach((item, index) => {
        const progress = count > 1 ? index / (count - 1) : 0;
        let startPos: number;
        let endPos: number;

        if (isMobile) {
          startPos = Math.round(20 + progress * 50);
          endPos = startPos + 10;
        } else {
          startPos = Math.round(6 + progress * 60);
          endPos = startPos + 20;
        }

        createItemTimeline(item, startPos, endPos);
      });

      const handleResize = () => {
        ScrollTrigger.refresh();
      };

      window.addEventListener("resize", handleResize);

      return () => {
        Object.values(titleSplits).forEach((split) => split?.revert?.());
        Object.values(descriptionSplits).forEach((split) => split?.revert?.());
        window.removeEventListener("resize", handleResize);
      };
    },
    { dependencies: [normalizedDuration, reducedMotion], scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      id="milestones"
      className="h-[210vw] max-[600px]:h-[420vh] w-full relative"
      style={sectionStyle}
    >
      <div className="h-screen w-full sticky top-[0%] pt-[8%] overflow-hidden max-[600px]:top-[4%] max-[600px]:pt-[12%]">
        <div
          ref={wholeSliderRef}
          className="mr-[2vw] flex h-[32vw] w-[240vw] items-center gap-[4vw] px-[5vw] max-[600px]:h-[82vh] max-[600px]:w-[800vw] max-[600px]:px-[7vw]"
        >
          {/* Leading Media Card */}
          <div className="h-full w-[28vw] overflow-hidden rounded-[1.2vw] border border-white/10 max-[600px]:h-[65vw] max-[600px]:w-[85vw] max-[600px]:rounded-[4vw] shadow-2xl relative group">
            <img
              src={imageUrl}
              alt={imageAlt}
              draggable={false}
              className="h-full w-full object-cover grayscale contrast-125 transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-[2vw] max-[600px]:p-[5vw]">
              <span className="font-mono text-[0.7vw] max-[600px]:text-[2.6vw] uppercase tracking-widest text-crimson">
                SLIIT SINAI Lab
              </span>
              <p className="font-display text-[1.4vw] max-[600px]:text-[4.8vw] font-bold text-white leading-tight">
                Sinhala News NLP &amp; Engineering Journey
              </p>
            </div>
          </div>

          <div className="relative h-full w-full">
            {/* Horizontal Timeline Spine Line */}
            <div className="w-full absolute left-0 top-[49%] -translate-y-1/2 flex items-center h-fit">
              <div
                className="h-[.8vw] max-[600px]:h-[2vw] max-[600px]:w-[2vw] w-[.8vw] rounded-full shadow-lg"
                style={activeStyle}
              ></div>
              <div
                className="h-[2px] w-[0%] rounded-full journey-line shadow-sm"
                style={activeStyle}
              ></div>
              <div
                className="h-[.8vw] max-[600px]:h-[2vw] max-[600px]:w-[2vw] w-[.8vw] rounded-full shadow-lg"
                style={activeStyle}
              ></div>
            </div>

            {/* Top Row: Items above the spine */}
            <div className="flex h-1/2 w-full items-center justify-start gap-[1vw]">
              <div className="h-full w-[20%] pt-[1vw] max-[600px]:h-fit max-[600px]:pt-[3vw]">
                <p className="font-mono text-[0.75vw] max-[600px]:text-[2.6vw] uppercase tracking-widest text-crimson mb-2 font-semibold">
                  Evolution
                </p>
                <h2 className="w-[85%] font-display text-[2.8vw] leading-[0.98] font-bold max-[600px]:text-[7.8vw]">
                  {title}
                </h2>
              </div>

              <div className="w-full flex h-full gap-x-[14vw] max-[600px]:gap-x-[36vw]">
                {resolvedTopItems.map((item) => (
                  <div
                    key={`top-${item.id}`}
                    className="relative h-full w-[30vw] px-[2vw] max-[600px]:flex max-[600px]:w-[70vw] max-[600px]:flex-col max-[600px]:px-[6vw]"
                  >
                    {/* Vertical Connector Stem & Dot */}
                    <div className="w-full absolute left-0 bottom-0 top-0 h-full">
                      <div
                        className={`size-[1vw] max-[600px]:size-[2.5vw] -translate-x-1/2 relative aspect-square rounded-full jd-${item.id} shadow-md`}
                        style={activeStyle}
                      ></div>
                      <div
                        className={`h-[94%] w-px origin-bottom rounded-full jl-${item.id}`}
                        style={activeStyle}
                      ></div>
                    </div>

                    {/* Milestone Copy */}
                    <div className="mt-[-1vw] space-y-[0.6vw] max-[600px]:mt-[-2vw]">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-[0.8vw] max-[600px]:text-[2.8vw] font-bold tracking-wider px-2.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${activeColor}24`,
                            color: activeColor,
                          }}
                        >
                          {item.when || `${item.year} ${item.month}`}
                        </span>
                        {item.source && (
                          <span className="text-[0.7vw] max-[600px]:text-[2.4vw] uppercase tracking-wider text-white/50">
                            {item.source}
                          </span>
                        )}
                      </div>
                      <h4
                        className={`title-${item.id} font-display text-[1.7vw] font-bold leading-tight max-[600px]:text-[5.2vw]`}
                      >
                        {item.title}
                      </h4>
                      <p
                        className={`description-${item.id} w-[92%] text-[0.95vw] leading-relaxed max-[600px]:w-[95%] max-[600px]:text-[3.6vw]`}
                        style={mutedTextStyle}
                      >
                        {item.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Row: Items below the spine */}
            <div className="h-1/2 flex items-center justify-start w-full">
              <div className="w-[30%] pt-[2vw] max-[600px]:pt-[4vw] max-[600px]:w-[28%] h-full">
                <p
                  className="font-mono text-[1.1vw] leading-none max-[600px]:text-[3.6vw] tracking-wider"
                  style={mutedTextStyle}
                >
                  {periodLabel}
                </p>
              </div>

              <div className="w-full flex h-full gap-x-[18vw] ml-[6vw] max-[600px]:gap-x-[36vw] max-[600px]:ml-[6vw]">
                {resolvedBottomItems.map((item) => (
                  <div
                    key={`bottom-${item.id}`}
                    className="relative h-full w-[26vw] px-[2vw] max-[600px]:w-[70vw] max-[600px]:px-[6vw]"
                  >
                    {/* Vertical Connector Stem & Dot */}
                    <div className="w-full absolute left-0 bottom-[-1%] h-full">
                      <div
                        className={`h-[94%] origin-top w-px rounded-full max-[600px]:h-full jl-${item.id}`}
                        style={activeStyle}
                      ></div>
                      <div
                        className={`size-[1vw] max-[600px]:size-[2.5vw] -translate-x-1/2 relative w-auto aspect-square rounded-full jd-${item.id} shadow-md`}
                        style={activeStyle}
                      ></div>
                    </div>

                    {/* Milestone Copy */}
                    <div className="flex h-full w-full flex-col justify-end space-y-[0.6vw]">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-mono text-[0.8vw] max-[600px]:text-[2.8vw] font-bold tracking-wider px-2.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${activeColor}24`,
                            color: activeColor,
                          }}
                        >
                          {item.when || `${item.year} ${item.month}`}
                        </span>
                        {item.source && (
                          <span className="text-[0.7vw] max-[600px]:text-[2.4vw] uppercase tracking-wider text-white/50">
                            {item.source}
                          </span>
                        )}
                      </div>
                      <h4
                        className={`title-${item.id} font-display text-[1.7vw] font-bold leading-tight max-[600px]:text-[5.2vw]`}
                      >
                        {item.title}
                      </h4>
                      <p
                        className={`description-${item.id} w-[92%] text-[0.95vw] leading-relaxed max-[600px]:w-[95%] max-[600px]:text-[3.6vw]`}
                        style={mutedTextStyle}
                      >
                        {item.content}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
