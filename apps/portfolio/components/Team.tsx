import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Mail, GraduationCap, Users } from "lucide-react";
import { SUPERVISORS, TEAM } from "@/content/team";
import { SITE } from "@/content/site";
import { TOOL_ICONS } from "@/components/toolIcons";
import { Section, SectionHeader, TextLink } from "@/components/ui";

const TOOL_LINKS: Record<string, string> = {
  grammar: "/research/grammar-checker",
  headlines: "/research/headline-generator",
  summaries: "/research/news-summarizer",
  style: "/research/style-rewriter",
};

/**
 * Team credits and supervisory committee for SinAI.
 * Displays faculty supervisors and core undergraduate researchers with
 * portrait photography, individual tool specializations, formal names, and IDs.
 */
export default function Team() {
  return (
    <Section id="team">
      <SectionHeader
        eyebrow="The team"
        title="The people behind SinAI."
        lede={`Developed and evaluated by four undergraduate researchers under faculty guidance at SLIIT (${SITE.projectCode}).`}
      />

      {/* Supervisors Section */}
      <div className="mb-14">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-crimson-tint text-crimson">
            <GraduationCap className="h-4 w-4" />
          </span>
          <h3 className="font-display text-base font-bold uppercase tracking-wider text-[#3d3b37]">
            Research Supervision & Guidance
          </h3>
          <div className="h-px flex-1 bg-line/60" />
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {SUPERVISORS.map((person) => (
            <article
              key={person.name}
              className="group relative flex flex-col items-center gap-5 rounded-3xl border border-line bg-panel-bg p-6 text-center transition-all duration-300 hover:border-crimson/30 hover:bg-white hover:shadow-xl hover:shadow-black/5 hover:-translate-y-0.5 sm:flex-row sm:items-start sm:p-7 sm:text-left"
            >
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-white shadow-xs ring-1 ring-black/5 sm:h-28 sm:w-28">
                <Image
                  src={person.imageUrl}
                  alt={person.name}
                  width={120}
                  height={120}
                  className="h-full w-full object-cover object-top transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              <div className="flex-1">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-crimson/15 bg-crimson-tint px-3 py-0.5 text-xs font-semibold text-crimson">
                  <span className="h-1.5 w-1.5 rounded-full bg-crimson" />
                  {person.role}
                </span>

                <h4 className="mt-2.5 font-display text-2xl font-bold tracking-tight text-black-main">
                  {person.name}
                </h4>

                <p className="mt-1 text-sm font-medium text-[#3d3b37]">
                  {person.department}
                </p>

                <p className="text-sm text-[#5f5c56]">
                  {person.affiliation}
                </p>

                {person.email && (
                  <a
                    href={`mailto:${person.email}`}
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-[#78746c] transition-colors hover:text-crimson"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>{person.email}</span>
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Undergraduate Research & Engineering Team */}
      <div>
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-crimson-tint text-crimson">
            <Users className="h-4 w-4" />
          </span>
          <h3 className="font-display text-base font-bold uppercase tracking-wider text-[#3d3b37]">
            Core Research & Engineering Team
          </h3>
          <div className="h-px flex-1 bg-line/60" />
        </div>

        {TEAM.length > 0 ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {TEAM.map((m) => {
              const Icon = TOOL_ICONS[m.toolId];
              const researchHref = TOOL_LINKS[m.toolId] ?? "/research";

              return (
                <li
                  key={m.name}
                  className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-line bg-white p-5 transition-all duration-300 hover:border-crimson/40 hover:shadow-xl hover:shadow-crimson/5 hover:-translate-y-1"
                >
                  <div>
                    {/* Portrait Photo Container */}
                    <div className="relative mb-4 aspect-square w-full overflow-hidden rounded-2xl border border-line/60 bg-stone-100 shadow-xs">
                      <Image
                        src={m.imageUrl}
                        alt={m.name}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                        className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>

                    {/* Member Details */}
                    <div className="px-1">
                      {/* Component Tag under image */}
                      <div className="mb-2.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-crimson/15 bg-crimson-tint px-2.5 py-1 text-xs font-semibold text-crimson">
                          <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                          <span>{m.component}</span>
                        </span>
                      </div>

                      <h4 className="font-display text-xl font-bold leading-snug text-black-main transition-colors group-hover:text-crimson">
                        {m.profileUrl ? (
                          <a
                            href={m.profileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline"
                          >
                            {m.name}
                          </a>
                        ) : (
                          m.name
                        )}
                      </h4>

                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-[#78746c]">
                        <span>{m.formalName}</span>
                        <span className="text-[#BDBAB2]">·</span>
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-[#5f5c56]">
                          {m.studentId}
                        </span>
                      </p>

                      <p className="mt-2.5 text-xs leading-relaxed text-[#5f5c56]">
                        {m.roleDescription}
                      </p>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="mt-5 flex items-center justify-between border-t border-line/60 px-1 pt-3.5">
                    <Link
                      href={researchHref}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-crimson transition-colors hover:text-crimson-dark"
                    >
                      <span>Research details</span>
                      <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                    </Link>

                    {m.email && (
                      <a
                        href={`mailto:${m.email}`}
                        title={`Email ${m.name}`}
                        className="rounded-lg p-1 text-[#8C8880] transition-colors hover:bg-stone-100 hover:text-crimson"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-lg text-[#3d3b37]">
            Built by the {SITE.researchTitle} research team ({SITE.projectCode}).
          </p>
        )}
      </div>

      {/* Public Repository & Open Science Note */}
      <div className="mt-10 rounded-2xl border border-line bg-panel-bg/50 p-5 text-center sm:flex sm:items-center sm:justify-between sm:text-left">
        <p className="text-sm text-[#5f5c56]">
          Faculty of Computing, Sri Lanka Institute of Information Technology (SLIIT). The code, commit history, and model weights are documented and open.
        </p>
        <div className="mt-3 shrink-0 sm:mt-0 sm:pl-4">
          <TextLink href={SITE.repoUrl}>Browse GitHub repository</TextLink>
        </div>
      </div>
    </Section>
  );
}
