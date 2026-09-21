import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SITE } from "@/content/site";
import { DEMO_TOOLS } from "@/content/demo";
import { ButtonLink, IllustrativeBadge, Sinhala } from "@/components/ui";
import { DiffText } from "@/components/DiffText";

/**
 * Homepage hero.
 *
 * Marketplace verification depends on four things staying exactly as they are:
 *   1. the <h1> reads "SinAI Document Assistant"
 *   2. the visible "Application purpose" statement (SITE.purposeLead)
 *   3. a link to /docs-addon
 *   4. visible links to /docs-addon/privacy and /docs-addon/terms
 */
export default function Hero() {
  const example = DEMO_TOOLS[0].examples[0];

  return (
    <section
      id="hero"
      className="relative overflow-hidden pb-20 pt-32 sm:pb-28 sm:pt-40"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#cd191a]/10 via-[#ff4b2b]/5 to-transparent blur-3xl"
      />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-12">
        <div className="lg:col-span-6">
          <Link
            href="/docs-addon"
            className="group inline-flex items-center gap-2 rounded-full border border-line bg-white px-4 py-1.5 text-sm font-medium text-[#3d3b37] shadow-sm transition-colors hover:border-crimson focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson"
          >
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-crimson"
            />
            SinAI Document Assistant for Google Docs
            <ArrowUpRight
              aria-hidden="true"
              className="h-4 w-4 text-crimson transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </Link>

          <h1 className="wordmark mt-6 font-display text-5xl font-bold leading-[1.05] tracking-tight text-black-main text-balance sm:text-6xl">
            SinAI Document Assistant
          </h1>
          <p className="mt-4 font-display text-2xl font-normal leading-snug text-[#3d3b37] sm:text-3xl">
            Write clearer Sinhala news, faster.
          </p>

          <div className="mt-8 rounded-2xl border border-line bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-crimson">
              Application purpose and overview
            </p>
            <p className="mt-2 text-base leading-relaxed text-[#3d3b37]">
              <strong className="font-semibold text-black-main">
                SinAI Document Assistant
              </strong>{" "}
              {SITE.purposeRest} {SITE.purposeDetail}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href={SITE.appUrl} variant="accent">
              Try SinAi Workspace
            </ButtonLink>
            <ButtonLink href="/docs-addon" variant="secondary">
              Google Docs add-on
            </ButtonLink>
          </div>

          <p className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-base text-[#5f5c56]">
            <Link
              href="/docs-addon/privacy"
              className="font-medium underline decoration-line underline-offset-4 hover:text-crimson hover:decoration-crimson"
            >
              Privacy Policy
            </Link>
            <Link
              href="/docs-addon/terms"
              className="font-medium underline decoration-line underline-offset-4 hover:text-crimson hover:decoration-crimson"
            >
              Terms of Service
            </Link>
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-line pt-8">
            {[
              ["4", "writing tools"],
              ["3", "places to use them"],
              ["5", "newspaper styles"],
            ].map(([n, label]) => (
              <div key={label}>
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="block font-display text-4xl font-bold text-black-main">
                    {n}
                  </span>
                  <span className="mt-1 block text-base text-[#5f5c56]">
                    {label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Example card */}
        <div className="lg:col-span-6">
          <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_60px_-20px_rgba(27,27,27,0.25)]">
            <div className="flex items-center gap-2 border-b border-line bg-panel-bg px-4 py-3">
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#e97371]" />
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#dcb46a]" />
              <span aria-hidden="true" className="h-3 w-3 rounded-full bg-[#7fb88a]" />
              <span className="ml-2 text-sm font-medium text-[#5f5c56]">
                Grammar checker
              </span>
            </div>

            <div className="space-y-6 p-5 sm:p-7">
              <IllustrativeBadge />

              <div>
                <p className="mb-2 text-sm font-semibold text-[#5f5c56]">
                  Your draft
                </p>
                <p className="text-lg leading-loose text-black-main">
                  <Sinhala>
                    <DiffText runs={example.input} side="input" />
                  </Sinhala>
                </p>
                <p className="mt-2 text-sm text-[#5f5c56]">
                  English: {example.inputGloss}
                </p>
              </div>

              <div className="border-t border-dashed border-line pt-6">
                <p className="mb-2 text-sm font-semibold text-emerald-800">
                  Corrected
                </p>
                <p className="text-lg leading-loose text-black-main">
                  <Sinhala>
                    <DiffText runs={example.outputs[0].runs} side="output" />
                  </Sinhala>
                </p>
                <p className="mt-3 rounded-xl bg-panel-bg px-4 py-3 text-base text-[#3d3b37]">
                  {example.note}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
