import type { Run } from "@/content/demo";

/**
 * Renders Sinhala text with corrected words marked. Colour is never the only
 * signal: the old word is struck through and the new one is bold, so the
 * difference is visible to colour-blind readers and in print.
 */
export function DiffText({
  runs,
  side,
}: {
  runs: Run[];
  side: "input" | "output";
}) {
  return (
    <>
      {runs.map((r, i) =>
        r.changed ? (
          side === "input" ? (
            <del
              key={i}
              className="rounded bg-red-50 px-0.5 text-red-700 decoration-red-400 decoration-2"
            >
              {r.text}
            </del>
          ) : (
            <ins
              key={i}
              className="rounded bg-emerald-50 px-0.5 font-semibold text-emerald-800 no-underline"
            >
              {r.text}
            </ins>
          )
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </>
  );
}
