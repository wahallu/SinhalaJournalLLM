import {
  EVAL_META,
  OVERALL_EASY,
  OVERALL_USEFUL,
  RESPONDENT_ROLES,
  agreeCount,
  mean,
  total,
  usefulness,
} from "@/content/evaluation";
import { QUOTES, QUOTES_NOTE } from "@/content/testimonials";
import { TOOLS } from "@/content/tools";
import { RatingBar, RatingLegend } from "@/components/RatingBar";
import { Section, SectionHeader, TextLink } from "@/components/ui";
import { Quote } from "lucide-react";

/**
 * Real feedback from the team's human evaluation. Every number is derived from
 * the raw counts in content/evaluation.ts, and the sample size is stated up
 * front so nobody has to hunt for it.
 */
function BigStat({
  value,
  label,
  detail,
}: {
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-line bg-white p-7">
      <p className="font-sans text-6xl font-bold leading-none tabular-nums text-crimson">
        {value}
        <span className="text-2xl text-[#8C8880]"> / 5</span>
      </p>
      <p className="mt-4 text-lg font-medium text-black-main">{label}</p>
      <p className="mt-1 text-base text-[#5f5c56]">{detail}</p>
    </div>
  );
}

export default function Feedback() {
  const n = EVAL_META.n;

  return (
    <Section id="feedback">
      <SectionHeader
        eyebrow="Early feedback"
        title={`What ${n} testers told us`}
        lede={`Editors, journalism students and teachers tried SinAi in ${EVAL_META.period} and rated it from 1 to 5. It is a small pilot, so read it as early impressions, not proof.`}
      />

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-5 lg:grid-cols-1">
          <BigStat
            value={mean(OVERALL_USEFUL.counts).toFixed(1)}
            label="“Useful for journalism-related tasks”"
            detail={`${agreeCount(OVERALL_USEFUL.counts)} of ${total(OVERALL_USEFUL.counts)} testers rated it 4 or 5`}
          />
          <BigStat
            value={mean(OVERALL_EASY.counts).toFixed(1)}
            label="“Easy to use”"
            detail={`${agreeCount(OVERALL_EASY.counts)} of ${total(OVERALL_EASY.counts)} testers rated it 4 or 5`}
          />
        </div>

        <div className="rounded-3xl border border-line bg-white p-7 sm:p-9 lg:col-span-7">
          <h3 className="font-display text-2xl font-bold text-black-main">
            “Useful for journalism work”, by tool
          </h3>
          <p className="mt-1 text-base text-[#5f5c56]">
            Average rating out of 5, with how many of {n} testers chose 4 or 5.
          </p>
          <div className="mt-7 space-y-6">
            {TOOLS.map((t) => (
              <RatingBar
                key={t.id}
                label={t.name}
                counts={usefulness(t.id).counts}
              />
            ))}
          </div>
          <div className="mt-6 border-t border-line pt-4">
            <RatingLegend />
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {QUOTES.map((q) => (
          <figure
            key={q.text}
            className="rounded-3xl border border-line bg-white p-7"
          >
            <Quote aria-hidden="true" className="h-6 w-6 text-crimson/40" />
            <blockquote className="mt-3 font-display text-xl leading-snug text-black-main">
              “{q.text}”
            </blockquote>
            <figcaption className="mt-4 text-base text-[#5f5c56]">
              {q.role}
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="mt-4 text-base text-[#5f5c56]">{QUOTES_NOTE}</p>

      <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 text-base text-[#5f5c56] sm:flex-row sm:items-center sm:justify-between">
        <p>
          Who took part:{" "}
          {RESPONDENT_ROLES.map((r) => `${r.count} ${r.label.toLowerCase()}`).join(
            ", ",
          )}
          .
        </p>
        <TextLink href="/research#human-evaluation">See every question and score</TextLink>
      </div>
    </Section>
  );
}
