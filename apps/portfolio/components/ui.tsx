import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Shared layout primitives. Keeping spacing, type sizes and button styles in
 * one place is what makes the pages feel consistent: body copy is at least
 * 16px, headings are sentence case, and there are no tiny uppercase labels.
 */

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}

type Tone = "light" | "panel" | "dark";

const TONES: Record<Tone, string> = {
  light: "bg-page-bg text-text-main",
  panel: "bg-panel-bg text-text-main",
  dark: "bg-[#151515] text-white",
};

export function Section({
  id,
  tone = "light",
  className = "",
  children,
}: {
  id?: string;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-24 py-20 sm:py-28 ${TONES[tone]} ${className}`}
    >
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  lede,
  align = "left",
  invert = false,
  className = "",
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  invert?: boolean;
  className?: string;
}) {
  const center = align === "center";
  return (
    <div
      className={`mb-12 sm:mb-16 max-w-3xl ${center ? "mx-auto text-center" : ""} ${className}`}
    >
      {eyebrow && (
        <p
          className={`mb-3 text-sm font-semibold ${invert ? "text-[#ff8a8a]" : "text-crimson"}`}
        >
          {eyebrow}
        </p>
      )}
      <h2
        className={`font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.12] text-balance ${invert ? "text-white" : "text-black-main"}`}
      >
        {title}
      </h2>
      {lede && (
        <p
          className={`mt-5 text-lg leading-relaxed ${invert ? "text-white/75" : "text-[#5f5c56]"}`}
        >
          {lede}
        </p>
      )}
    </div>
  );
}

type Variant = "primary" | "accent" | "secondary" | "onDark";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-black-main text-white hover:bg-crimson",
  accent: "bg-crimson text-white hover:bg-crimson-dark",
  secondary:
    "bg-white text-black-main border border-line hover:border-black-main",
  onDark: "bg-white/10 text-white border border-white/20 hover:bg-white/20",
};

export function ButtonLink({
  href,
  children,
  variant = "primary",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  className?: string;
}) {
  const external = /^https?:\/\//.test(href);
  const classes = `group inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-semibold shadow-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson ${VARIANTS[variant]} ${className}`;
  const icon = (
    <ArrowUpRight
      aria-hidden="true"
      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
    />
  );
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={classes}
      >
        {children}
        {icon}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
      {icon}
    </Link>
  );
}

/** Understated inline link, for secondary actions. */
export function TextLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const external = /^https?:\/\//.test(href);
  const classes = `inline-flex items-center gap-1 font-semibold text-black-main underline decoration-line underline-offset-4 transition-colors hover:text-crimson hover:decoration-crimson focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson ${className}`;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {children}
        <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-line bg-white p-6 sm:p-8 shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${className}`}
    >
      {children}
    </div>
  );
}

/** Wraps Sinhala text so it gets the right language tag and font stack. */
export function Sinhala({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span lang="si" className={`font-sinhala ${className}`}>
      {children}
    </span>
  );
}

/** A label for anything that is not live output. */
export function IllustrativeBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-[#fdf3f2] px-3 py-1 text-sm font-semibold text-crimson-dark ${className}`}
    >
      Illustrative example — not a live result
    </span>
  );
}
