"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { useShell } from "@/components/shell/shell-context";
import { projectBrief } from "@/lib/content/brief";

export function BriefSheet() {
  const { briefOpen, setBriefOpen } = useShell();

  return (
    <Sheet open={briefOpen} onOpenChange={setBriefOpen}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Project brief</SheetTitle>
          <SheetDescription>{projectBrief.tagline}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            {projectBrief.summary}
          </p>

          <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-border/60">
            {projectBrief.stats.map((stat) => (
              <div key={stat.label} className="flex flex-col gap-0.5 bg-background p-3">
                <span className="text-lg font-semibold text-primary">{stat.value}</span>
                <span className="text-[11px] leading-tight text-muted-foreground">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              Team
            </span>
            <p className="text-sm text-foreground">
              {projectBrief.teamSize} people, supervised by {projectBrief.supervisor}.
            </p>
          </div>

          {projectBrief.latestPublication && (
            <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-3">
              <Badge variant="outline">
                Latest paper · {projectBrief.latestPublication.year}
              </Badge>
              <p className="text-sm font-medium text-foreground">
                {projectBrief.latestPublication.title}
              </p>
            </div>
          )}
        </div>

        <SheetFooter>
          <Link
            href="/research"
            onClick={() => setBriefOpen(false)}
            className={buttonVariants({ className: "w-full" })}
          >
            Read the full research
            <ArrowRightIcon strokeWidth={1.75} />
          </Link>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
