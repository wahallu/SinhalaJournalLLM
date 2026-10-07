"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronDown, Menu, X } from "lucide-react";
import { SITE } from "@/content/site";
import { SCOPE_SECTIONS } from "@/content/projectScope";

// Hash links start with "/" so they also work from /privacy, /research, etc.
const LINKS = [
  { href: "/#about", label: "About" },
  { href: "/#milestones", label: "Milestones" },
  { href: "/#library", label: "Documents" },
  { href: "/#achievements", label: "Outputs" },
  { href: "/#team", label: "Team" },
  { href: "/#contact", label: "Contact" },
];

// Vertical point, in px from the top of the viewport, sampled to decide
// whether the header is sitting over a dark or a light section.
const PROBE_Y = 36;

/** True when the section under the header is marked data-nav-theme="dark". */
function isOverDark() {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-nav-theme="dark"]'),
  ).some((el) => {
    const r = el.getBoundingClientRect();
    return r.top <= PROBE_Y && r.bottom > PROBE_Y;
  });
}

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(true);
  const [scopeOpen, setScopeOpen] = useState(false);
  const scopeRef = useRef<HTMLDivElement>(null);

  // Close the Project scope menu on Escape or a click outside it.
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
  const cta = dark
    ? "bg-white text-neutral-900 hover:bg-white/90"
    : "bg-black-main text-white hover:bg-crimson";
  const focus = dark ? "focus-visible:outline-white" : "focus-visible:outline-black-main";

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
                className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 ${focus} ${link}`}
              >
                Project scope
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
                    {SCOPE_SECTIONS.map((s) => (
                      <li key={s.id} className="border-b border-black/5 last:border-0">
                        <Link
                          href={`/project-scope#${s.id}`}
                          onClick={() => setScopeOpen(false)}
                          className="block px-4 py-3 text-[15px] font-medium text-black-main transition-colors hover:bg-crimson-tint hover:text-crimson"
                        >
                          {s.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 ${focus} ${link}`}
              >
                {l.label}
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
                href="/project-scope"
                onClick={() => setOpen(false)}
                className="block rounded-2xl px-4 py-3 text-base font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
              >
                Project scope
              </Link>
              <ul className="mb-1 ml-4 border-l border-white/10 pl-2">
                {SCOPE_SECTIONS.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/project-scope#${s.id}`}
                      onClick={() => setOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm text-white/65 transition-colors hover:bg-white/10 hover:text-white"
                    >
                      {s.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-2xl px-4 py-3 text-base font-medium text-white/85 transition-colors hover:bg-white/10 hover:text-white"
                >
                  {l.label}
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
