"use client";

import { useShell } from "@/components/shell/shell-context";
import { useAssistant } from "@/components/shell/assistant-store";

const PROMPTS = [
  "what has sinai built?",
  "who's on the team?",
  "what are the results?",
];

export function HomeAssistantChips() {
  const { setAssistantOpen } = useShell();
  const { sendMessage } = useAssistant();

  function ask(prompt: string) {
    setAssistantOpen(true);
    void sendMessage(prompt);
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {PROMPTS.map((prompt) => (
        <button
          key={prompt}
          type="button"
          onClick={() => ask(prompt)}
          className="rounded-full border border-border/60 bg-background/60 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur-md transition-colors hover:border-border hover:text-foreground"
        >
          <span aria-hidden className="mr-1 text-muted-foreground">
            ›
          </span>
          {prompt}
        </button>
      ))}
    </div>
  );
}
