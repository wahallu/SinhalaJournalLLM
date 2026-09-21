import { Section, SectionHeader } from "@/components/ui";

const POINTS = [
  {
    title: "The problem",
    body: "Sinhala has far fewer datasets, benchmarks and ready-made writing tools than English. Everyday newsroom jobs (checking grammar, writing a headline, condensing a long story) take time, and there has been little tool support for them.",
  },
  {
    title: "What SinAi does",
    body: "SinAi is a set of four writing tools trained on Sinhala news. Paste in your text, pick a task and review the result. It works in a web app, a Chrome extension and Google Docs.",
  },
  {
    title: "Who it is for",
    body: "Reporters and sub-editors working to deadline, editors reviewing copy, and journalism students and teachers. Anyone who writes formal Sinhala can use it.",
  },
];

export default function WhatIsIt() {
  return (
    <Section id="what" tone="panel">
      <SectionHeader
        eyebrow="What is it?"
        title="One assistant for the everyday jobs of Sinhala news writing."
        lede="You stay in charge of the story. SinAi handles the routine work and shows you what it changed."
      />
      <div className="grid gap-6 md:grid-cols-3">
        {POINTS.map((p, i) => (
          <div
            key={p.title}
            className="rounded-3xl border border-line bg-page-bg p-7"
          >
            <span
              aria-hidden="true"
              className="font-display text-4xl font-bold text-crimson/30"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <h3 className="mt-3 font-display text-2xl font-bold text-black-main">
              {p.title}
            </h3>
            <p className="mt-3 text-base leading-relaxed text-[#4a4741]">
              {p.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
