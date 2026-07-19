import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { publications } from "@/lib/content/publications";
import { TuckMascot } from "@/components/shell/tuck-mascot";

export const metadata: Metadata = {
  title: "Papers",
  description: "Publications and working papers from the sinai research project.",
};

// Interim page: full publication list, ahead of the fuch.ai-style card
// redesign (plan Phase G).
export default function PublicationsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-24 pb-24 sm:px-6 sm:pt-28 lg:px-8">
      <TuckMascot />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Written up for the department and beyond.
      </h1>

      <div className="mt-10 flex flex-col divide-y divide-border/60 border-t border-border/60">
        {publications.map((pub) => (
          <div key={pub.slug} className="flex flex-col gap-2 py-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-base font-medium text-foreground">{pub.title}</h2>
              <Badge variant="outline" className="shrink-0">
                {pub.year}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {pub.authors.join(", ")} — {pub.venue}
            </p>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {pub.abstract}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
