import { CHALLENGES, ENGINE } from "@/content/research";
import { SINLLAMA } from "@/content/site";
import { Section, SectionHeader, TextLink } from "@/components/ui";

export function EngineSection() {
  return (
    <Section id="engine">
      <SectionHeader
        eyebrow="The AI engine"
        title="More than a chatbot wrapper: specialists, fallbacks and fact checks."
        lede="Plain version: small task-specific models, a gateway that keeps working when parts fail, and rule-based checks that catch what a language model gets wrong."
      />

      <div className="mb-8 rounded-3xl border border-line bg-white p-7 sm:p-9">
        <h3 className="font-display text-2xl font-bold text-black-main">
          The base model
        </h3>
        <p className="mt-3 max-w-3xl text-base leading-relaxed text-[#3d3b37]">
          SinAi adapts <strong>{SINLLAMA.name}</strong>, a Llama 3 8B model
          extended for Sinhala by Aravinda et al. We did not repeat its
          tokenizer extension or continual pretraining. Our contribution is the
          news corpus, four task datasets, the task adapters, the evaluation and
          the serving system around them.
        </p>
        <p className="mt-3 text-sm text-[#5f5c56]">
          {SINLLAMA.citation}{" "}
          <TextLink href={SINLLAMA.url}>Read the SinLlama paper</TextLink>
        </p>
      </div>

      <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {ENGINE.map((f) => (
          <li key={f.title} className="rounded-3xl border border-line bg-white p-7">
            <h3 className="font-display text-xl font-bold text-black-main">{f.title}</h3>
            <p className="mt-1 text-base font-medium text-crimson-dark">{f.plain}</p>
            <p className="mt-3 text-base leading-relaxed text-[#5f5c56]">{f.detail}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function ChallengesSection() {
  return (
    <Section id="challenges" tone="dark">
      <SectionHeader
        invert
        eyebrow="Engineering challenges"
        title="What went wrong, and what we did about it."
        lede="Most of the value in this project came from finding flaws in our own data and tests. These are the five that mattered most."
      />
      <ol className="space-y-6">
        {CHALLENGES.map((c, i) => (
          <li
            key={c.title}
            className="rounded-3xl border border-white/10 bg-white/5 p-7 sm:p-9"
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-crimson font-display text-lg font-bold text-white"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="font-display text-2xl font-bold text-white">{c.title}</h3>
                <p className="mt-1 text-lg text-[#ff8a8a]">{c.plain}</p>
              </div>
            </div>
            <dl className="mt-6 grid gap-6 md:grid-cols-3">
              {(
                [
                  ["The problem", c.problem],
                  ["What we found", c.found],
                  ["What we did", c.fix],
                ] as const
              ).map(([label, text]) => (
                <div key={label}>
                  <dt className="text-sm font-semibold text-white/60">{label}</dt>
                  <dd className="mt-2 text-base leading-relaxed text-white/85">{text}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ol>
    </Section>
  );
}
