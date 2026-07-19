import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { HeroVisual } from "@/components/home/hero-visual";

export function Hero() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-16 pb-20 sm:px-6 lg:px-8 lg:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        <div className="flex flex-col gap-6">
          <h1 className="max-w-xl text-4xl font-semibold tracking-tighter text-foreground md:text-5xl lg:text-6xl">
            One Sinhala model, four newsroom skills.
          </h1>
          <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
            SinLlama fixes grammar, writes headlines, rewrites tone, and
            summarizes news, all in Sinhala.
          </p>
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
        </div>

        <div className="flex justify-center lg:justify-end">
          <HeroVisual />
        </div>
      </div>
    </section>
  );
}
