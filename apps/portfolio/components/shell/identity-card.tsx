import Link from "next/link";
import { siteConfig } from "@/lib/config/site";

export function IdentityCard() {
  return (
    <Link
      href="/"
      className="pointer-events-auto flex flex-col gap-0.5 rounded-2xl px-1 py-0.5 transition-opacity hover:opacity-80"
    >
      <span className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
        <span aria-hidden className="size-2 rounded-full bg-primary" />
        {siteConfig.name}.
      </span>
      <span className="font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
        {siteConfig.tagline}
      </span>
    </Link>
  );
}
