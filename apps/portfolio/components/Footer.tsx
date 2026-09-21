import Image from "next/image";
import Link from "next/link";
import { SITE } from "@/content/site";
import { TOOLS } from "@/content/tools";

/**
 * Site footer. Shared by every page, including the legal pages, so it keeps
 * the exact product name and the privacy / terms / support links that the
 * Google Workspace Marketplace review looks for.
 */

const linkClass =
  "text-white/70 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded";

export default function Footer() {
  return (
    <footer className="bg-[#121212] text-white">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <Link href="/" className="inline-flex items-center gap-3">
              <Image
                src="/brand/web-app-manifest-192x192.png"
                alt={`${SITE.name} logo`}
                width={40}
                height={40}
                className="h-10 w-10 rounded-xl object-cover"
              />
              <span className="wordmark font-display text-xl font-bold">
                {SITE.name}
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-base leading-relaxed text-white/70">
              Writing tools for Sinhala news: grammar, headlines, style and
              summaries, built by the {SITE.researchTitle} research team.
            </p>
            <p className="mt-4 text-base text-white/70">
              Questions?{" "}
              <a
                href={`mailto:${SITE.supportEmail}`}
                className="font-semibold text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                {SITE.supportEmail}
              </a>
            </p>
          </div>

          <nav aria-label="Product" className="md:col-span-2">
            <h2 className="text-sm font-semibold text-white">Use it</h2>
            <ul className="mt-4 space-y-3 text-base">
              <li>
                <a
                  href={SITE.appUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Web app
                </a>
              </li>
              <li>
                <a
                  href={SITE.extensionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Chrome extension
                </a>
              </li>
              <li>
                <Link href="/docs-addon" className={linkClass}>
                  Google Docs add-on
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="Research" className="md:col-span-2">
            <h2 className="text-sm font-semibold text-white">Research</h2>
            <ul className="mt-4 space-y-3 text-base">
              <li>
                <Link href="/research" className={linkClass}>
                  Overview
                </Link>
              </li>
              {TOOLS.map((t) => (
                <li key={t.id}>
                  <Link href={t.href} className={linkClass}>
                    {t.name}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href={SITE.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  Source code
                </a>
              </li>
            </ul>
          </nav>

          <nav aria-label="Support and legal" className="md:col-span-3">
            <h2 className="text-sm font-semibold text-white">Support and legal</h2>
            <ul className="mt-4 space-y-3 text-base">
              <li>
                <Link href="/privacy" className={linkClass}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className={linkClass}>
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/support" className={linkClass}>
                  Support and setup guide
                </Link>
              </li>
              <li>
                <Link href="/support#report-issue" className={linkClass}>
                  Report an issue
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-t border-white/10 pt-6 text-sm text-white/60 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 {SITE.organisation}.</p>
          <p className="flex gap-5">
            <Link href="/privacy" className={linkClass}>
              Privacy
            </Link>
            <Link href="/terms" className={linkClass}>
              Terms
            </Link>
            <Link href="/support" className={linkClass}>
              Support
            </Link>
          </p>
        </div>
      </div>
    </footer>
  );
}
