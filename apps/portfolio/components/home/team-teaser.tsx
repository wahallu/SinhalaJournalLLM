import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { teamMembers } from "@/lib/content/team";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("");
}

export function TeamTeaser() {
  const featured = teamMembers.slice(0, 3);

  return (
    <section className="border-t border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="max-w-lg text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Built by a four-person undergraduate research team.
          </h2>
          <Link
            href="/team"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
          >
            Meet the team
            <ArrowRightIcon strokeWidth={1.75} className="size-3.5" />
          </Link>
        </div>

        <div className="mt-10 flex flex-wrap gap-6">
          {featured.map((member) => (
            <div key={member.name} className="flex items-center gap-3">
              <Avatar className="size-11">
                <AvatarImage
                  src={`https://picsum.photos/seed/${member.avatarSeed}/88/88`}
                  alt=""
                />
                <AvatarFallback>{initials(member.name)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {member.name}
                </p>
                <p className="text-xs text-muted-foreground">{member.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
