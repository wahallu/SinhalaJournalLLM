"use client";

import { useEffect, useState } from "react";
import { siteConfig } from "@/lib/config/site";
import { projectBrief } from "@/lib/content/brief";
import { cn } from "@/lib/utils";

type ModelStatus = {
  primary: string;
  providers: Record<string, { available: boolean }>;
} | null;

export function StatusTicker() {
  const [status, setStatus] = useState<ModelStatus>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetch(`${siteConfig.apiBaseUrl}/api/v1/meta`, {
      signal: AbortSignal.timeout(4000),
    })
      .then((res) => {
        if (!res.ok) throw new Error("meta unavailable");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setStatus(data?.model ?? null);
      })
      .catch(() => {
        if (!cancelled) setErrored(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const available = status ? status.providers?.[status.primary]?.available : undefined;

  return (
    <div className="pointer-events-auto flex max-w-full items-center gap-3 overflow-hidden rounded-full border border-border/60 bg-background/80 px-3 py-1.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase shadow-sm backdrop-blur-md">
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span
          aria-hidden
          className={cn(
            "size-1.5 rounded-full",
            available
              ? "bg-primary"
              : errored
                ? "bg-destructive"
                : "bg-muted-foreground/40"
          )}
        />
        {status
          ? `model ${status.primary} · ${available ? "online" : "fallback"}`
          : errored
            ? "model status unavailable"
            : "checking model status…"}
      </span>
      <span aria-hidden className="hidden h-3 w-px shrink-0 bg-border sm:block" />
      <span className="hidden truncate sm:block">
        trained on {projectBrief.sources.join(" · ")}
      </span>
    </div>
  );
}
