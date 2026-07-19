"use client";

import { PauseIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useShell } from "@/components/shell/shell-context";

export function UtilityBar() {
  const { animationsPaused, toggleAnimationsPaused } = useShell();

  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 bg-background/80 p-1 shadow-sm backdrop-blur-md">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={animationsPaused ? "Resume animations" : "Pause animations"}
        aria-pressed={animationsPaused}
        onClick={toggleAnimationsPaused}
        className="rounded-full text-muted-foreground hover:text-foreground"
      >
        {animationsPaused ? (
          <PlayIcon strokeWidth={1.75} />
        ) : (
          <PauseIcon strokeWidth={1.75} />
        )}
      </Button>
    </div>
  );
}
