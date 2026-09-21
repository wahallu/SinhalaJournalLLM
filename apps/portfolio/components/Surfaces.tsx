import { CheckCircle2, FileText, Globe, Laptop, type LucideIcon } from "lucide-react";
import { SURFACES, type Surface } from "@/content/tools";
import { ButtonLink, Section, SectionHeader } from "@/components/ui";

const ICONS: Record<Surface["id"], LucideIcon> = {
  web: Laptop,
  chrome: Globe,
  docs: FileText,
};

export default function Surfaces() {
  return (
    <Section id="where">
      <SectionHeader
        eyebrow="Where to use it"
        title="Use SinAi where you already write."
        lede="The same four tools are available in three places, so you do not have to change how you work."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        {SURFACES.map((s) => {
          const Icon = ICONS[s.id];
          return (
            <article
              key={s.id}
              className="flex flex-col rounded-3xl border border-line bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black-main text-white">
                <Icon aria-hidden="true" className="h-6 w-6" />
              </span>
              <h3 className="mt-5 font-display text-2xl font-bold text-black-main">
                {s.name}
              </h3>
              <p className="mt-1 text-lg font-medium text-[#3d3b37]">{s.tagline}</p>
              <p className="mt-3 text-base leading-relaxed text-[#5f5c56]">
                {s.description}
              </p>
              <ul className="mt-5 space-y-2.5">
                {s.points.map((p) => (
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
                <ButtonLink href={s.cta.href} variant="secondary" className="w-full">
                  {s.cta.label}
                </ButtonLink>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
