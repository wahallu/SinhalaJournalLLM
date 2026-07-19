import type { Metadata } from "next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { heroStats } from "@/lib/content/results";
import { supervisor, teamMembers } from "@/lib/content/team";
import { TuckMascot } from "@/components/shell/tuck-mascot";

export const metadata: Metadata = {
  title: "Team",
  description: "The four-person undergraduate research team behind sinai, and their supervisor.",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

// Interim page: full team + supervisor + stats, ahead of the fuch.ai-style
// bio/manifesto redesign (plan Phase F).
export default function TeamPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pt-24 pb-24 sm:px-6 sm:pt-28 lg:px-8">
      <TuckMascot />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Built by a four-person undergraduate research team.
      </h1>

      <div className="mt-10 grid gap-px overflow-hidden rounded-xl bg-border/60 sm:grid-cols-3">
        {heroStats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 bg-background p-5">
            <span className="font-mono text-2xl font-medium tabular-nums text-foreground">
              {stat.value}
            </span>
            <span className="text-sm font-medium text-foreground">{stat.label}</span>
            <span className="text-xs text-muted-foreground">{stat.detail}</span>
          </div>
        ))}
      </div>

      <div className="mt-12 flex flex-col divide-y divide-border/60 border-t border-border/60">
        {[supervisor, ...teamMembers].map((member) => (
          <div key={member.name} className="flex items-center gap-4 py-6">
            <Avatar className="size-12">
              <AvatarImage src={`https://picsum.photos/seed/${member.avatarSeed}/96/96`} alt="" />
              <AvatarFallback>{initials(member.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{member.name}</p>
              <p className="text-xs text-muted-foreground">{member.role}</p>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                {member.bio}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
