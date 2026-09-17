import { useMemo, useState } from 'react';

/**
 * GitHub-style calendar heatmap of daily request counts.
 *
 * One sequential hue, four steps light→dark (`--heat-1`..`--heat-4` in
 * index.css), each validated per-theme against its own canvas with
 * dataviz's validate_palette.js --ordinal — a straight reuse of the
 * brand-400/500/600/800 Tailwind classes breaks lightness monotonicity in
 * dark mode, because brand-600 is deliberately pinned to one hex across
 * both themes for button consistency. See the CSS comment for the trap.
 *
 * Cells are not individually focusable: 90+ tab stops on one grid is its
 * own accessibility failure. The grid is `role="img"` with a summary label,
 * and the "View as a list" toggle below is the real keyboard/screen-reader
 * path to the same data — a plain, fully navigable list rather than a
 * dense figure with the API's `title` attribute as the only mouse-hover
 * detail.
 */

const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

function level(requests, max) {
  if (!requests) return 0;
  if (!max) return 1;
  return Math.min(4, Math.max(1, Math.ceil((requests / max) * 4)));
}

function formatDay(iso) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

/** Pad the front of `series` to a Sunday, then chunk into 7-day columns. */
function buildWeeks(series) {
  if (!series.length) return [];
  const firstDow = new Date(`${series[0].day}T00:00:00Z`).getUTCDay();
  const padded = [...Array.from({ length: firstDow }, () => null), ...series];
  const weeks = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  return weeks;
}

export default function UsageHeatmap({ series }) {
  const [showList, setShowList] = useState(false);
  const [hovered, setHovered] = useState(null);

  const max = useMemo(
    () => series.reduce((m, p) => Math.max(m, p.requests), 0),
    [series]
  );
  const weeks = useMemo(() => buildWeeks(series), [series]);
  const total = useMemo(() => series.reduce((sum, p) => sum + p.requests, 0), [series]);

  return (
    <div>
      <div className="flex items-start gap-3 overflow-x-auto pb-1">
        <div className="flex flex-col gap-[3px] pt-[15px] shrink-0">
          {WEEKDAY_LABELS.map((label, i) => (
            <span key={i} className="h-[11px] text-[9px] leading-[11px] text-ink-400">
              {label}
            </span>
          ))}
        </div>

        <div
          role="img"
          aria-label={`Request activity for the last ${series.length} days, ${total} total. Use "View as a list" for the day-by-day breakdown.`}
          className="flex gap-[3px]"
        >
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell, di) => (
                <div
                  key={di}
                  aria-hidden="true"
                  onMouseEnter={() => cell && setHovered(cell)}
                  onMouseLeave={() => setHovered((h) => (h === cell ? null : h))}
                  className={`relative h-[11px] w-[11px] rounded-[2px] ${cell ? 'cursor-default' : ''}`}
                  style={{ background: cell ? `var(--heat-${level(cell.requests, max)})` : 'transparent' }}
                >
                  {cell && hovered === cell && (
                    <div className="pointer-events-none absolute -top-8 left-1/2 z-20 -translate-x-1/2
                      whitespace-nowrap rounded-md bg-ink-900 px-2 py-1 text-[11px] font-medium
                      text-white shadow-pop dark:bg-ink-950">
                      {cell.requests} {cell.requests === 1 ? 'request' : 'requests'} · {formatDay(cell.day)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setShowList((v) => !v)}
          className="cursor-pointer text-[11.5px] font-semibold text-brand-700 hover:underline"
        >
          {showList ? 'Hide list' : 'View as a list'}
        </button>
        <div className="flex items-center gap-1.5 text-[10.5px] text-ink-400">
          <span>Less</span>
          {[0, 1, 2, 3, 4].map((l) => (
            <span key={l} className="h-[10px] w-[10px] rounded-[2px]" style={{ background: `var(--heat-${l})` }} />
          ))}
          <span>More</span>
        </div>
      </div>

      {showList && (
        <ul className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-ink-200 divide-y divide-ink-100">
          {[...series].reverse().filter((p) => p.requests > 0).map((p) => (
            <li key={p.day} className="flex items-center justify-between px-3 py-1.5 text-[12px]">
              <span className="text-ink-600">{formatDay(p.day)}</span>
              <span className="font-semibold text-ink-900">{p.requests}</span>
            </li>
          ))}
          {series.every((p) => p.requests === 0) && (
            <li className="px-3 py-3 text-center text-[12px] text-ink-400">No activity in this range yet.</li>
          )}
        </ul>
      )}
    </div>
  );
}
