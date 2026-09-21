import { agreeCount, mean, total, type Counts } from "@/content/evaluation";

/**
 * Stacked bar showing how the respondents rated one statement, from 1 (left)
 * to 5 (right). The numbers are always printed next to the bar so it can be
 * read without relying on colour.
 */
const SEGMENT_COLOURS = [
  "bg-[#E4E2DB]", // 1
  "bg-[#CFCCC3]", // 2
  "bg-[#B5B1A6]", // 3
  "bg-[#e97371]", // 4
  "bg-[#cd191a]", // 5
];

export function RatingBar({
  label,
  counts,
  showLabel = true,
}: {
  label: string;
  counts: Counts;
  showLabel?: boolean;
}) {
  const n = total(counts);
  const m = mean(counts).toFixed(1);
  const agree = agreeCount(counts);
  const description = `${label}: average ${m} out of 5. ${agree} of ${n} respondents rated it 4 or 5.`;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-4">
        {showLabel && (
          <p className="text-base font-medium text-black-main">{label}</p>
        )}
        <p className="shrink-0 text-base text-[#5f5c56]">
          <span className="font-sans text-xl font-bold tabular-nums text-black-main">
            {m}
          </span>
          <span className="text-sm"> / 5 · {agree} of {n} rated 4–5</span>
        </p>
      </div>
      <div
        role="img"
        aria-label={description}
        className="flex h-3 w-full overflow-hidden rounded-full bg-panel-bg"
      >
        {counts.map((c, i) =>
          c === 0 ? null : (
            <div
              key={i}
              className={SEGMENT_COLOURS[i]}
              style={{ width: `${(c / n) * 100}%` }}
            />
          ),
        )}
      </div>
    </div>
  );
}

/** Small legend explaining the colours, shown once per group of bars. */
export function RatingLegend() {
  return (
    <ul
      aria-label="Rating colour key"
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#5f5c56]"
    >
      {SEGMENT_COLOURS.map((c, i) => (
        <li key={i} className="flex items-center gap-1.5">
          <span aria-hidden="true" className={`h-3 w-3 rounded-full ${c}`} />
          {i + 1}
          {i === 0 && " (disagree)"}
          {i === 4 && " (agree)"}
        </li>
      ))}
    </ul>
  );
}
