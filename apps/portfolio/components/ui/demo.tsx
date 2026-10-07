"use client";

import Timeline from "@/components/ui/timeline";

const settings = {
  textColor: "var(--color-foreground, #FAF9F5)",
  mutedTextColor: "var(--color-muted-foreground, #a1a1aa)",
  activeColor: "#cd191a",
  backgroundColor: "var(--color-background, #121212)",
  duration: 1.4,
};

export default function TimelineDemo(props: Partial<typeof settings>) {
  const s = { ...settings, ...props };
  return (
    <main className="bg-background text-foreground">
      {/* Lead-in so the pinned timeline has somewhere to scroll in from. */}
      <section className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Research roadmap
        </p>
        <h1 className="max-w-[18ch] text-4xl font-bold leading-tight tracking-tight sm:text-6xl font-display">
          From 665K Sinhala news articles to a deployed suite.
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Keep scrolling — the section pins, the track slides sideways, and each
          milestone draws its stem and reveals its copy as it reaches centre.
        </p>
        <span className="mt-2 animate-bounce text-muted-foreground">&darr;</span>
      </section>

      {/* Realistic usage: custom copy, a branded accent, tuned reveal speed. */}
      <Timeline
        title="Research Milestones"
        periodLabel="March — Sept 2026"
        backgroundColor={s.backgroundColor}
        textColor={s.textColor}
        mutedTextColor={s.mutedTextColor}
        activeColor={s.activeColor}
        imageUrl="https://images.unsplash.com/photo-1585829365295-ab7cd400c167?q=80&w=1200&auto=format&fit=crop"
        imageAlt="Sinhala journalistic research and archive"
        duration={s.duration}
      />

      <section className="flex h-screen items-center justify-center px-6 text-center text-sm text-muted-foreground">
        From initial corpus extraction to newsroom user evaluations.
      </section>
    </main>
  );
}
