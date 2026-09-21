import { TEAM } from "@/content/team";
import { SITE } from "@/content/site";
import { TOOL_ICONS } from "@/components/toolIcons";
import { Section, SectionHeader, TextLink } from "@/components/ui";

/**
 * Team credits. With no members listed in content/team.ts this falls back to
 * a project-level credit, so the section never shows empty placeholders.
 */
export default function Team() {
  return (
    <Section id="team">
      <SectionHeader
        eyebrow="The team"
        title="The team behind SinAi."
        lede={`SinAi is the ${SITE.researchTitle} research project (${SITE.projectCode}).${TEAM.length > 0 ? " Each team member built and evaluated one of the tools." : ""}`}
      />

      {TEAM.length > 0 ? (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TEAM.map((m) => {
            const Icon = TOOL_ICONS[m.toolId];
            return (
              <li
                key={m.name}
                className="rounded-3xl border border-line bg-white p-7"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdf3f2] text-crimson">
                  <Icon aria-hidden="true" className="h-6 w-6" />
                </span>
                <p className="mt-5 font-display text-xl font-bold leading-snug text-black-main">
                  {m.profileUrl ? (
                    <a
                      href={m.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-crimson"
                    >
                      {m.name}
                    </a>
                  ) : (
                    m.name
                  )}
                </p>
                <p className="mt-1 text-base text-[#5f5c56]">{m.component}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-lg text-[#3d3b37]">
          Built by the {SITE.researchTitle} research team ({SITE.projectCode}).
        </p>
      )}

      <p className="mt-8 text-base text-[#5f5c56]">
        The code, commit history and documentation are public.{" "}
        <TextLink href={SITE.repoUrl}>Browse the repository</TextLink>
      </p>
    </Section>
  );
}
