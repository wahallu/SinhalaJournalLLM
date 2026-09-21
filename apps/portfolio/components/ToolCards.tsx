import { CheckCircle2 } from "lucide-react";
import { TOOLS } from "@/content/tools";
import { Section, SectionHeader, TextLink } from "@/components/ui";
import { TOOL_ICONS } from "@/components/toolIcons";

export default function ToolCards() {
  return (
    <Section id="tools">
      <SectionHeader
        eyebrow="The tools"
        title="Four tools, each built for one job."
        lede="Every tool has its own model trained for that task, so a grammar fix and a headline are not the same guesswork."
      />
      <div className="grid gap-6 md:grid-cols-2">
        {TOOLS.map((tool) => {
          const Icon = TOOL_ICONS[tool.id];
          return (
            <article
              key={tool.id}
              className="flex flex-col rounded-3xl border border-line bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-lg sm:p-9"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fdf3f2] text-crimson">
                <Icon aria-hidden="true" className="h-6 w-6" />
              </span>
              <h3 className="mt-5 font-display text-2xl font-bold text-black-main sm:text-3xl">
                {tool.name}
              </h3>
              <p className="mt-2 text-lg font-medium text-[#3d3b37]">
                {tool.tagline}
              </p>
              <p className="mt-3 text-base leading-relaxed text-[#5f5c56]">
                {tool.description}
              </p>
              <ul className="mt-5 space-y-2.5">
                {tool.points.map((p) => (
                  <li key={p} className="flex items-start gap-3 text-base text-[#3d3b37]">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-1 h-4 w-4 shrink-0 text-crimson"
                    />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-7">
                <TextLink href={tool.href}>How the {tool.name.toLowerCase()} was built</TextLink>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
