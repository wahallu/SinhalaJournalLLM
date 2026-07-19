"use client";

import type { ReactNode } from "react";
import { ShellProvider } from "@/components/shell/shell-context";
import { AssistantProvider } from "@/components/shell/assistant-store";
import { IdentityCard } from "@/components/shell/identity-card";
import { NavPill } from "@/components/shell/nav-pill";
import { UtilityBar } from "@/components/shell/utility-bar";
import { StatusTicker } from "@/components/shell/status-ticker";
import { ModelCore } from "@/components/shell/model-core";
import { BriefSheet } from "@/components/shell/brief-sheet";
import { AssistantDrawer } from "@/components/shell/assistant-drawer";
import { RouteTransition } from "@/components/shell/route-transition";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <ShellProvider>
      <AssistantProvider>
        <a
          href="#main-content"
          className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:rounded-full focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-primary-foreground"
        >
          Skip to content
        </a>

        <div className="pointer-events-none fixed top-4 left-4 z-40 sm:top-6 sm:left-6">
          <IdentityCard />
        </div>

        <div className="pointer-events-none fixed top-4 right-4 z-40 sm:top-6 sm:right-6">
          <NavPill />
        </div>

        <div className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex items-center gap-3 sm:inset-x-6 sm:bottom-6">
          <UtilityBar />
          <StatusTicker />
        </div>

        <ModelCore className="pointer-events-none fixed inset-0 z-20 flex items-center justify-center" />

        <BriefSheet />
        <AssistantDrawer />

        <main id="main-content" className="relative z-10 flex flex-1 flex-col">
          <RouteTransition>{children}</RouteTransition>
        </main>
      </AssistantProvider>
    </ShellProvider>
  );
}
