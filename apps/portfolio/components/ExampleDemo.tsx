"use client";

import { useState } from "react";
import { DEMO_TOOLS } from "@/content/demo";
import { SITE } from "@/content/site";
import { ButtonLink, IllustrativeBadge, Section, SectionHeader, Sinhala } from "@/components/ui";
import { DiffText } from "@/components/DiffText";

/**
 * "See it in action". Every input/output pair here is a hand-written example,
 * so nothing pretends to be live: results appear instantly, the section is
 * labelled illustrative, and the call to action sends people to the real app.
 */
export default function ExampleDemo() {
  const [toolIdx, setToolIdx] = useState(0);
  const [exampleIdx, setExampleIdx] = useState(0);
  const [gloss, setGloss] = useState(true);

  const tool = DEMO_TOOLS[toolIdx];
  const example = tool.examples[exampleIdx] ?? tool.examples[0];

  const pick = (i: number) => {
    setToolIdx(i);
    setExampleIdx(0);
  };

  const pill = (active: boolean) =>
    `rounded-full px-5 py-2.5 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson ${
      active
        ? "bg-black-main text-white"
        : "border border-line bg-white text-[#3d3b37] hover:border-black-main"
    }`;

  return (
    <Section id="demo" tone="panel">
      <SectionHeader
        eyebrow="See it in action"
        title="Pick a tool and see what comes back."
        lede="These examples show the kind of result each tool gives. To run it on your own text, open the app."
      />

      <div className="rounded-[2rem] border border-line bg-white p-5 shadow-[0_24px_60px_-28px_rgba(27,27,27,0.25)] sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div role="group" aria-label="Choose a tool" className="flex flex-wrap gap-2">
            {DEMO_TOOLS.map((t, i) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={i === toolIdx}
                onClick={() => pick(i)}
                className={pill(i === toolIdx)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <IllustrativeBadge />
        </div>

        {tool.examples.length > 1 && (
          <div
            role="group"
            aria-label="Choose an example"
            className="mt-4 flex flex-wrap items-center gap-2"
          >
            <span className="mr-1 text-base text-[#5f5c56]">Example:</span>
            {tool.examples.map((ex, i) => (
              <button
                key={ex.id}
                type="button"
                aria-pressed={i === exampleIdx}
                onClick={() => setExampleIdx(i)}
                className={`rounded-full px-4 py-1.5 text-base font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson ${
                  i === exampleIdx
                    ? "bg-[#fdf3f2] text-crimson-dark ring-1 ring-crimson/30"
                    : "text-[#5f5c56] hover:bg-panel-bg"
                }`}
              >
                {ex.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-page-bg p-5 sm:p-6">
            <h3 className="text-base font-semibold text-[#5f5c56]">
              Input (Sinhala)
            </h3>
            <p className="mt-3 text-lg leading-loose text-black-main">
              <Sinhala>
                <DiffText runs={example.input} side="input" />
              </Sinhala>
            </p>
            {gloss && (
              <p className="mt-3 border-t border-line pt-3 text-base text-[#5f5c56]">
                <span className="font-semibold">English:</span> {example.inputGloss}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 sm:p-6">
            <h3 className="text-base font-semibold text-emerald-900">
              {tool.outputLabel}
            </h3>
            <ol
              className={`mt-3 space-y-4 ${example.outputs.length > 1 ? "list-decimal pl-5 marker:font-semibold marker:text-emerald-800" : "list-none"}`}
            >
              {example.outputs.map((o, i) => (
                <li key={i}>
                  <p className="text-lg leading-loose text-black-main">
                    <Sinhala>
                      <DiffText runs={o.runs} side="output" />
                    </Sinhala>
                  </p>
                  {gloss && (
                    <p className="mt-1 text-base text-[#5f5c56]">
                      <span className="font-semibold">English:</span> {o.gloss}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>
        </div>

        <p className="mt-5 rounded-xl bg-panel-bg px-5 py-4 text-base leading-relaxed text-[#3d3b37]">
          <span className="font-semibold text-black-main">What to notice: </span>
          {example.note}
        </p>

        <div className="mt-6 flex flex-col items-start justify-between gap-5 border-t border-line pt-6 sm:flex-row sm:items-center">
          <label className="flex cursor-pointer items-center gap-3 text-base text-[#3d3b37]">
            <input
              type="checkbox"
              checked={gloss}
              onChange={(e) => setGloss(e.target.checked)}
              className="h-5 w-5 rounded border-line accent-crimson"
            />
            Show approximate English translation
          </label>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <ButtonLink href={SITE.appUrl} variant="accent">
              Try it with your own text
            </ButtonLink>
            <p className="text-sm text-[#5f5c56]">
              You can try it without an account. Signed-out use is limited and
              results are not saved.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}
