import { Database, Globe, Laptop, FileText, Server, Cpu } from "lucide-react";
import { Section, SectionHeader } from "@/components/ui";

/**
 * System architecture, drawn with plain HTML so it reflows on phones and
 * reads well to screen readers. Content follows README "Architecture" and
 * apps/backend-api/app/core/model_gateway.py.
 */
function Arrow({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-4 text-center">
      <span aria-hidden="true" className="text-2xl leading-none text-crimson">↓</span>
      <span className="max-w-md text-sm text-[#5f5c56]">{label}</span>
    </div>
  );
}

const CLIENTS = [
  { name: "Web app", icon: Laptop },
  { name: "Chrome extension", icon: Globe },
  { name: "Google Docs add-on", icon: FileText },
];

const TIERS = [
  {
    name: "Research model",
    body: "SinLlama base with the task’s LoRA adapter, on the GPU server.",
  },
  {
    name: "Hosted backup",
    body: "A hosted language model (via OpenRouter) when the GPU server is down.",
  },
  {
    name: "Rule-based fallback",
    body: "Deterministic output that never fails, so the product keeps responding.",
  },
];

export function ArchitectureSection() {
  return (
    <Section id="architecture" tone="panel">
      <SectionHeader
        eyebrow="How it fits together"
        title="Three apps, one backend, and a model gateway that does not fall over."
        lede="Plain version: every app sends text to the same backend, which picks the right model and never leaves you without an answer."
      />

      <figure>
        <div className="mx-auto max-w-4xl rounded-[2rem] border border-line bg-page-bg p-5 sm:p-9">
          <div className="grid gap-4 sm:grid-cols-3">
            {CLIENTS.map(({ name, icon: Icon }) => (
              <div
                key={name}
                className="flex items-center justify-center gap-3 rounded-2xl border border-line bg-white px-4 py-4"
              >
                <Icon aria-hidden="true" className="h-5 w-5 text-crimson" />
                <span className="text-base font-semibold text-black-main">{name}</span>
              </div>
            ))}
          </div>

          <Arrow label="Send the text over HTTPS, signed in with a token or anonymously with rate limits." />

          <div className="rounded-2xl border-2 border-black-main bg-white p-6">
            <div className="flex items-center gap-3">
              <Server aria-hidden="true" className="h-5 w-5 text-crimson" />
              <h3 className="font-display text-xl font-bold text-black-main">
                Backend API (FastAPI)
              </h3>
            </div>
            <ul className="mt-4 grid gap-x-8 gap-y-2 text-base text-[#3d3b37] sm:grid-cols-2">
              <li>Checks who you are (signed tokens)</li>
              <li>Applies rate limits and feature switches</li>
              <li>Builds the prompt the task was trained on</li>
              <li>Checks and saves the result</li>
            </ul>
          </div>

          <Arrow label="Ask the gateway for a result; read and write history." />

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="rounded-2xl border border-line bg-white p-6 lg:col-span-3">
              <div className="flex items-center gap-3">
                <Cpu aria-hidden="true" className="h-5 w-5 text-crimson" />
                <h3 className="font-display text-xl font-bold text-black-main">
                  Model gateway
                </h3>
              </div>
              <p className="mt-1 text-base text-[#5f5c56]">
                Tries each tier in order. If one fails, the next answers.
              </p>
              <ol className="mt-4 space-y-3">
                {TIERS.map((t, i) => (
                  <li key={t.name} className="flex gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-black-main text-sm font-bold text-white"
                    >
                      {i + 1}
                    </span>
                    <span className="text-base text-[#3d3b37]">
                      <span className="font-semibold text-black-main">{t.name}.</span>{" "}
                      {t.body}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl border border-line bg-white p-6 lg:col-span-2">
              <div className="flex items-center gap-3">
                <Database aria-hidden="true" className="h-5 w-5 text-crimson" />
                <h3 className="font-display text-xl font-bold text-black-main">
                  Database (Supabase Postgres)
                </h3>
              </div>
              <ul className="mt-4 space-y-2 text-base text-[#3d3b37]">
                <li>Per-user history under row-level security</li>
                <li>Runtime settings and feature switches</li>
                <li>Audit log and usage telemetry</li>
              </ul>
            </div>
          </div>
        </div>
        <figcaption className="mx-auto mt-5 max-w-3xl text-center text-base text-[#5f5c56]">
          Each response reports which tier answered, so an app can tell you when
          a backup was used.
        </figcaption>
      </figure>
    </Section>
  );
}
