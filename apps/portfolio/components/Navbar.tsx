"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { SITE } from "@/content/site";

// Hash links start with "/" so they also work from /privacy, /research, etc.
const LINKS = [
  { href: "/#tools", label: "Tools" },
  { href: "/#demo", label: "Demo" },
  { href: "/#where", label: "Where to use it" },
  { href: "/#feedback", label: "Feedback" },
  { href: "/research", label: "Research" },
  { href: "/#team", label: "Team" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  // Close the mobile menu with Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-3 sm:top-5 sm:px-6">
      <div className="pointer-events-auto relative w-full max-w-[1120px]">
        <div className="flex items-center justify-between gap-3 rounded-full border border-white/15 bg-[#151515]/92 py-2 pl-3 pr-2 shadow-[0_12px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl sm:pl-4">
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-2.5 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Image
              src="/brand/web-app-manifest-192x192.png"
              alt={`${SITE.name} logo`}
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
            <span className="wordmark truncate font-display text-[15px] font-bold tracking-tight text-white sm:text-base">
              {SITE.name}
            </span>
            <span className="hidden rounded-md border border-white/15 bg-white/10 px-1.5 py-0.5 text-xs font-medium text-white/75 sm:inline">
              Beta
            </span>
          </Link>

          <nav
            aria-label="Main"
            className="hidden items-center gap-0.5 lg:flex"
          >
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            <a
              href={SITE.appUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group hidden items-center gap-1.5 whitespace-nowrap rounded-full bg-crimson px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-crimson-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:inline-flex"
            >
              Try SinAi
              <ArrowUpRight
                aria-hidden="true"
                className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </a>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? "Close menu" : "Open menu"}
              className="rounded-full p-2 text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white lg:hidden"
            >
              {open ? (
                <X aria-hidden="true" className="h-5 w-5" />
              ) : (
                <Menu aria-hidden="true" className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {open && (
          <nav
            id="mobile-menu"
            aria-label="Mobile"
            className="absolute inset-x-0 top-full mt-2 rounded-3xl border border-white/15 bg-[#151515]/98 p-3 shadow-2xl backdrop-blur-2xl lg:hidden"
          >
            <ul className="flex flex-col">
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
                  className="flex items-center justify-center gap-2 rounded-full bg-crimson px-4 py-3 text-base font-semibold text-white transition-colors hover:bg-crimson-dark"
                >
                  Try SinAi Workspace
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
                </a>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </header>
  );
}
