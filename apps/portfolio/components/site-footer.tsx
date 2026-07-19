import Link from "next/link";
import { MailIcon } from "lucide-react";
import { siteConfig } from "@/lib/config/site";

function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  );
}

const footerLinks = [
  {
    heading: "Project",
    links: [
      { label: "Research", href: "/research" },
      { label: "Team", href: "/team" },
      { label: "Publications", href: "/publications" },
    ],
  },
  {
    heading: "Explore",
    links: [
      { label: "Playground", href: "/playground" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[2fr_1fr_1fr] lg:px-8">
        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground"
          >
            <span aria-hidden className="size-2 rounded-full bg-primary" />
            {siteConfig.name}
          </Link>
          <p className="max-w-[42ch] text-sm leading-relaxed text-muted-foreground">
            {siteConfig.tagline}. A university research project built on
            SinLlama, an extended Llama-3-8B for Sinhala.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <GithubMark className="size-5" />
            </a>
            <a
              href="mailto:contact@sinai.example"
              aria-label="Email"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <MailIcon strokeWidth={1.75} className="size-5" />
            </a>
          </div>
        </div>

        {footerLinks.map((group) => (
          <div key={group.heading} className="flex flex-col gap-3">
            <h3 className="text-sm font-medium text-foreground">
              {group.heading}
            </h3>
            <ul className="flex flex-col gap-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>© {new Date().getFullYear()} {siteConfig.name}. A university research project.</p>
          <p>Built with Next.js, Tailwind, and GSAP.</p>
        </div>
      </div>
    </footer>
  );
}
