import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { toolResults } from "@/lib/content/results";

export function ResultsHighlight() {
  return (
    <section className="border-t border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="max-w-lg text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Measured against held-out newspaper text.
          </h2>
          <Link
            href="/research"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          >
            Full methodology
            <ArrowRightIcon strokeWidth={1.75} className="size-3.5" />
          </Link>
        </div>

        <div className="mt-10 grid gap-px overflow-hidden rounded-xl bg-border/60 sm:grid-cols-2 lg:grid-cols-4">
          {toolResults.map((metric) => (
            <div key={metric.label} className="flex flex-col gap-2 bg-background p-6">
              <span className="font-mono text-3xl font-medium tabular-nums text-foreground">
                {metric.value}
              </span>
              <span className="text-sm font-medium text-foreground">
                {metric.label}
              </span>
              <span className="text-xs leading-relaxed text-muted-foreground">
                {metric.detail}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
