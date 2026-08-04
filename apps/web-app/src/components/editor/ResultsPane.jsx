/**
 * Right-hand pane shell: a header carrying the result label and any
 * display-only controls, over an independently scrolling body.
 *
 * Display options live here rather than in the editor toolbar because they
 * change how a result is shown, not what was requested (spec D2).
 */
export default function ResultsPane({ title, right, children }) {
  return (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="flex items-center gap-2 pb-2.5 shrink-0 min-h-8">
        <span className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.14em]">
          {title}
        </span>
        {right && <span className="ml-auto flex items-center gap-1.5">{right}</span>}
      </div>
      <div className="flex-1 min-h-0 xl:overflow-y-auto xl:pr-1">{children}</div>
    </div>
  );
}
