import { Section, SectionHeader, TextLink } from "@/components/ui";

const STEPS = [
  {
    title: "You paste or select text",
    body: "In the web app, the Chrome extension or a Google Doc. Choose the task you want.",
  },
  {
    title: "SinAi picks the right specialist",
    body: "Each task has its own small model trained for it, all built on one shared Sinhala language model.",
  },
  {
    title: "You get a result",
    body: "If the main model is unavailable, a backup answers so you are not left without a result.",
  },
  {
    title: "You review and decide",
    body: "Nothing is published for you. Accept a change, edit it or throw it away. AI can be wrong, so always read it first.",
  },
];

export default function HowItWorks() {
  return (
    <Section id="how" tone="dark">
      <SectionHeader
        invert
        eyebrow="How it works"
        title="From your draft to a reviewed result in four steps."
      />
      <ol className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li
            key={s.title}
            className="rounded-3xl border border-white/10 bg-white/5 p-7"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-crimson font-display text-lg font-bold text-white"
            >
              {i + 1}
            </span>
            <h3 className="mt-5 font-display text-xl font-bold text-white">
              <span className="sr-only">Step {i + 1}: </span>
              {s.title}
            </h3>
            <p className="mt-3 text-base leading-relaxed text-white/75">{s.body}</p>
          </li>
        ))}
      </ol>
      <p className="mt-10 text-base text-white/75">
        Curious about the engineering behind this?{" "}
        <TextLink
          href="/research#architecture"
          className="!text-white decoration-white/40 hover:!text-[#ff8a8a]"
        >
          See the architecture
        </TextLink>
      </p>
    </Section>
  );
}
