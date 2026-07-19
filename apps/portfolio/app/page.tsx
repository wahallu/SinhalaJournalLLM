import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { siteConfig } from "@/lib/config/site";
import { projectBrief } from "@/lib/content/brief";
import { HomeAssistantChips } from "@/components/home/home-assistant-chips";

// Single non-scrolling fold, matching fuch.ai's Home — the persistent shell
// (nav, mascot, assistant, status bar) carries the rest of the site; deeper
// content lives on /research, /team, /publications, /playground, /contact.
//
// Layout mirrors fuch.ai's composition: the giant wordmark + centered mascot
// own the middle of the screen, while the actual copy/CTAs sit bottom-left so
// the two never overlap.
export default function Home() {
  const latest = projectBrief.latestPublication;

  return (
    <section className="relative flex min-h-[100dvh] flex-col overflow-hidden">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[24vw] leading-none font-semibold tracking-tighter text-foreground/[0.05] select-none sm:text-[16vw] lg:text-[13rem]"
      >
        {siteConfig.name}
      </span>

      <div className="relative z-10 mt-auto flex w-full max-w-md flex-col gap-5 px-4 pt-16 pb-24 sm:px-6 sm:pb-28 lg:px-8">
        <Badge
          variant="outline"
          className="w-fit font-mono text-[10px] tracking-wider text-muted-foreground uppercase"
        >
          {siteConfig.tagline}
        </Badge>

        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          I&apos;m {siteConfig.name} — ask me anything about the model.
        </h1>

        <HomeAssistantChips />

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href="/playground"
            className={buttonVariants({ size: "lg", className: "px-6" })}
          >
            Try the playground
            <ArrowRightIcon strokeWidth={1.75} />
          </Link>
          <Link
            href="/research"
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className: "px-6",
            })}
          >
            Read the research
          </Link>
        </div>

        {latest && (
          <Link
            href="/publications"
            className="mt-1 inline-flex w-fit items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur-md transition-colors hover:text-foreground"
          >
            <span className="font-mono tracking-wider text-primary uppercase">
              Latest paper
            </span>
            <span className="max-w-[32ch] truncate">{latest.title}</span>
          </Link>
        )}
      </div>
    </section>
  );
}
