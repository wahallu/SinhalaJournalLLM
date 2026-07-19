"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileTextIcon, MenuIcon, MessageCircleIcon } from "lucide-react";
import { siteConfig } from "@/lib/config/site";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { useShell } from "@/components/shell/shell-context";
import { cn } from "@/lib/utils";

export function NavPill() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { setAssistantOpen, setBriefOpen } = useShell();

  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-border/60 bg-background/80 p-1 shadow-sm backdrop-blur-md">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Ask ${siteConfig.name}`}
        onClick={() => setAssistantOpen(true)}
        className="rounded-full text-muted-foreground hover:text-foreground"
      >
        <MessageCircleIcon strokeWidth={1.75} />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Open project brief"
        onClick={() => setBriefOpen(true)}
        className="rounded-full text-muted-foreground hover:text-foreground"
      >
        <FileTextIcon strokeWidth={1.75} />
      </Button>

      <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />

      <nav aria-label="Primary" className="hidden items-center gap-0.5 lg:flex">
        {siteConfig.nav.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden lg:block">
        <ThemeToggle />
      </div>

      <div className="lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <MenuIcon strokeWidth={1.75} />
          </Button>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>{siteConfig.name}</SheetTitle>
            </SheetHeader>
            <nav aria-label="Primary" className="flex flex-col gap-1 px-4">
              {siteConfig.nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-full px-3 py-2.5 text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-auto flex items-center gap-1 px-4 pb-4">
              <ThemeToggle />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
