import { AlignLeftIcon, NewspaperIcon, SpellCheckIcon, WandSparklesIcon } from "lucide-react";
import { playgroundTools } from "@/lib/content/playground";

const icons = {
  grammar: SpellCheckIcon,
  headline: NewspaperIcon,
  rewrite: WandSparklesIcon,
  summarize: AlignLeftIcon,
} as const;

const tints = {
  grammar: "bg-card border-border/60",
  headline: "bg-primary/[0.12] border-primary/25",
  rewrite: "bg-card border-border/60",
  summarize: "bg-primary/[0.12] border-primary/25",
} as const;

export function ApproachStrip() {
  return (
    <section className="border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="max-w-lg text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          One base model, four LoRA adapters.
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {playgroundTools.map((tool) => {
            const Icon = icons[tool.id];
            return (
              <div
                key={tool.id}
                className={`flex flex-col gap-4 rounded-xl border p-6 ${tints[tool.id]}`}
              >
                <Icon strokeWidth={1.5} className="size-6 text-foreground" />
                <div>
                  <h3 className="text-sm font-medium text-foreground">
                    {tool.label}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {tool.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
