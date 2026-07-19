import type { Metadata } from "next";
import { AlignLeftIcon, NewspaperIcon, SpellCheckIcon, WandSparklesIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { playgroundTools } from "@/lib/content/playground";
import { TuckMascot } from "@/components/shell/tuck-mascot";

export const metadata: Metadata = {
  title: "Play",
  description: "Try SinLlama's four Sinhala writing tools: grammar, headlines, style, and summaries.",
};

const icons = {
  grammar: SpellCheckIcon,
  headline: NewspaperIcon,
  rewrite: WandSparklesIcon,
  summarize: AlignLeftIcon,
} as const;

// Interim page: tool descriptions only. Wiring these to backend-api's real
// endpoints is plan Phase H — tracked in ROADMAP.md.
export default function PlaygroundPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-24 pb-24 sm:px-6 sm:pt-28 lg:px-8">
      <TuckMascot />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Four tools, one Sinhala model.
      </h1>
      <p className="mt-3 max-w-xl text-muted-foreground">
        Interactive versions wired to the live model are on the way.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {playgroundTools.map((tool) => {
          const Icon = icons[tool.id];
          return (
            <div
              key={tool.id}
              className="flex flex-col gap-4 rounded-xl border border-border/60 bg-card p-6"
            >
              <div className="flex items-center justify-between">
                <Icon strokeWidth={1.5} className="size-6 text-foreground" />
                <Badge variant="secondary">Coming soon</Badge>
              </div>
              <div>
                <h2 className="text-sm font-medium text-foreground">{tool.label}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {tool.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
