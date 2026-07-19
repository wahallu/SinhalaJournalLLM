import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

export function ProblemTeaser() {
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Sri Lankan newsrooms write in five different registers a day.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Most Sinhala language tools are trained on formal prose and break
            down on sports reporting, youth features, or editorial voice.
            SinLlama is fine-tuned directly on newspaper text across all five.
          </p>
          <Link
            href="/publications"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          >
            Read the published research
            <ArrowRightIcon strokeWidth={1.75} className="size-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
