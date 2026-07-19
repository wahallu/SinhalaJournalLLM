import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { publications } from "@/lib/content/publications";

export function PublicationsTeaser() {
  const featured = publications.slice(0, 2);

  return (
    <section className="border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="max-w-lg text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Written up for the department and beyond.
          </h2>
          <Link
            href="/publications"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          >
            All publications
            <ArrowRightIcon strokeWidth={1.75} className="size-3.5" />
          </Link>
        </div>

        <div className="mt-10 flex flex-col divide-y divide-border/60 border-t border-border/60">
          {featured.map((pub) => (
            <div
              key={pub.slug}
              className="flex flex-col gap-2 py-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8"
            >
              <div>
                <h3 className="text-base font-medium text-foreground">
                  {pub.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {pub.authors.join(", ")} - {pub.venue}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0">
                {pub.year}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
