"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { SITE } from "@/content/site";
import { SCOPE_SECTIONS } from "@/content/projectScope";
import { DOMAIN_TAB_ID, HOME_TAB, SECTION_TAB, TABS } from "@/content/navigation";

// The Domain items are sections of /project-scope, plus "Technologies used",
// which lives on the home page.
const DOMAIN_LINKS = [
  ...SCOPE_SECTIONS.map((s) => ({ label: s.label, href: `/project-scope#${s.id}` })),
  { label: "Technologies used", href: "/#technologies" },
];

// Vertical point, in px from the top of the viewport, sampled to decide
// whether the header is sitting over a dark or a light section.
const PROBE_Y = 36;

// A section counts as the current one once it reaches this line, just under
// the header. An anchor jump lands a section's top at about 80px.
const ACTIVE_PROBE_Y = 120;

/** True when the section under the header is marked data-nav-theme="dark". */
function isOverDark() {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-nav-theme="dark"]'),
  ).some((el) => {
    const r = el.getBoundingClientRect();
    return r.top <= PROBE_Y && r.bottom > PROBE_Y;
  });
}

/**
 * Id of the header tab whose home-page section is under the active probe
 * line, or null. When sections nest (#documents inside #library) the
 * smallest one wins.
 */
function useScrollTab(enabled: boolean) {
  const [tab, setTab] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      let best: { tab: string; height: number } | null = null;
      for (const [sectionId, tabId] of Object.entries(SECTION_TAB)) {
        const el = document.getElementById(sectionId);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (
          r.top <= ACTIVE_PROBE_Y &&
          r.bottom > ACTIVE_PROBE_Y &&
          (!best || r.height < best.height)
        ) {
          best = { tab: tabId, height: r.height };
        }
      }
      setTab(best ? best.tab : null);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [enabled]);

  return tab;
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);

  const pathname = (usePathname() ?? "/").replace(/\/$/, "") || "/";
  const scrollTab = useScrollTab(pathname === "/");
  const activeTab =
    pathname === "/" ? scrollTab : pathname === "/project-scope" ? DOMAIN_TAB_ID : null;

  // Close the Domain menu on Escape or a click outside it.
  useEffect(() => {
    if (!scopeOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setScopeOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (!scopeRef.current?.contains(e.target as Node)) setScopeOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [scopeOpen]);

  // Track the tone of the section under the header.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setDark(isOverDark());
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // Close the mobile menu with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Only the pill carries a background; the header itself stays clear.
  const pill = dark
    ? "bg-black/30 ring-white/15 backdrop-blur-xl"
    : "bg-page-bg/70 ring-black/10 backdrop-blur-xl";
  const link = dark
    ? "text-white/80 hover:text-white"
    : "text-black-main/75 hover:text-black-main";
  const current = dark
    ? "bg-white/15 text-white"
    : "bg-black/5 text-black-main";
  const cta = dark
    ? "bg-white text-neutral-900 hover:bg-white/90"
    : "bg-black-main text-white hover:bg-crimson";
  const focus = dark ? "focus-visible:outline-white" : "focus-visible:outline-black-main";

  const tabClass = (id: string) =>
    `rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 ${focus} ${
      activeTab === id ? current : link
    }`;
  const mobileClass = (id: string) =>
    `block rounded-2xl px-4 py-3 text-base font-medium transition-colors hover:bg-white/10 hover:text-white ${
      activeTab === id ? "bg-white/10 text-white" : "text-white/85"
    }`;

  return (
    // The header strip is see-through; only its pieces take clicks.
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-[72px] w-full max-w-7xl items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          aria-label={`${SITE.brand} home`}
          className={`pointer-events-auto font-gwen text-[30px] font-light leading-none tracking-tight transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-4 ${focus} ${dark ? "text-white" : "text-black-main"}`}
        >
          SinAi
        </Link>

        <nav aria-label="Main" className="pointer-events-auto hidden items-center lg:flex">
          <div
            className={`flex items-center gap-1 rounded-full px-1 py-1 ring-1 transition-colors duration-300 ${pill}`}
          >
            <Link
              href={HOME_TAB.href}
              aria-current={activeTab === HOME_TAB.id ? "true" : undefined}
              className={tabClass(HOME_TAB.id)}
            >
              {HOME_TAB.label}
            </Link>

            <div
              ref={scopeRef}
              className="relative"
              onMouseEnter={() => setScopeOpen(true)}
              onMouseLeave={() => setScopeOpen(false)}
            >
              <button
                type="button"
                // Hover already opens it, so a click only ever opens (a
                // toggle would close it again); Escape or an outside click closes.
                onClick={() => setScopeOpen(true)}
                aria-expanded={scopeOpen}
                aria-controls="scope-menu"
                aria-current={activeTab === DOMAIN_TAB_ID ? "true" : undefined}
                className={`inline-flex items-center gap-1 ${tabClass(DOMAIN_TAB_ID)}`}
              >
                Domain
                <ChevronDown
                  aria-hidden="true"
                  className={`h-3.5 w-3.5 transition-transform ${scopeOpen ? "rotate-180" : ""}`}
                />
              </button>
              {scopeOpen && (
                // pt-2 bridges the gap so the menu stays open while the
                // pointer moves down into it.
                <div id="scope-menu" className="absolute left-0 top-full w-72 pt-2">
                  <ul className="overflow-hidden rounded-2xl border border-black/10 bg-white py-1 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.3)]">
                    {DOMAIN_LINKS.map((item) => (
                      <li key={item.href} className="border-b border-black/5 last:border-0">
                        <Link
                          href={item.href}
                          onClick={() => setScopeOpen(false)}
                          className="block px-4 py-3 text-[15px] font-medium text-black-main transition-colors hover:bg-crimson-tint hover:text-crimson"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {TABS.map((t) => (
              <Link
                key={t.id}
                href={t.href}
                aria-current={activeTab === t.id ? "true" : undefined}
                className={tabClass(t.id)}
              >
                {t.label}
              </Link>
            ))}
            <a
              href={SITE.appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`ml-1 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${focus} ${cta}`}
            >
              Try SinAi
              <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </div>
        </nav>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          className={`pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full ring-1 transition-colors focus-visible:outline-2 lg:hidden ${focus} ${pill} ${dark ? "text-white/90" : "text-black-main"}`}
        >
          {open ? (
            <X aria-hidden="true" className="h-5 w-5" />
          ) : (
            <Menu aria-hidden="true" className="h-5 w-5" />
          )}
        </button>
      </div>

      {open && (
        <nav
          id="mobile-menu"
          aria-label="Mobile"
          className="pointer-events-auto mx-3 rounded-3xl border border-white/15 bg-[#151515]/95 p-3 shadow-2xl backdrop-blur-2xl lg:hidden"
        >
          <ul className="flex flex-col">
            <li>
              <Link
                href={HOME_TAB.href}
                onClick={() => setOpen(false)}
                aria-current={activeTab === HOME_TAB.id ? "true" : undefined}
                className={mobileClass(HOME_TAB.id)}
              >
                {HOME_TAB.label}
              </Link>
            </li>
            <li>
              <Link
                href="/project-scope"
                onClick={() => setOpen(false)}
                aria-current={activeTab === DOMAIN_TAB_ID ? "true" : undefined}
                className={mobileClass(DOMAIN_TAB_ID)}
              >
                Domain
              </Link>
              <ul className="mb-1 ml-4 border-l border-white/10 pl-2">
                {DOMAIN_LINKS.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm text-white/65 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
            {TABS.map((t) => (
              <li key={t.id}>
                <Link
                  href={t.href}
                  onClick={() => setOpen(false)}
                  aria-current={activeTab === t.id ? "true" : undefined}
                  className={mobileClass(t.id)}
                >
                  {t.label}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t border-white/10 pt-3">
              <a
                href={SITE.appUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-base font-medium text-neutral-900 transition-colors hover:bg-white/90"
              >
                Try SinAi
                <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
              </a>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
