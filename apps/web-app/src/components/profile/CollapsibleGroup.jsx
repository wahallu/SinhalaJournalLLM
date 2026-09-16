import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Disclosure with a collapsed summary line.
 *
 * The summary is the point. Folding Newsroom, Category and Interests onto
 * one panel only beats three separate tabs if a glance still tells you what
 * is selected in each.
 */
export default function CollapsibleGroup({ id, title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-ink-200 bg-white dark:bg-ink-50">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`profile-group-${id}`}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3.5 text-left
            focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15 sm:px-5"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-bold text-ink-900">{title}</span>
            <span className="mt-0.5 block truncate text-[12px] text-ink-500">{summary}</span>
          </span>
          <ChevronDown
            size={17}
            className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h3>
      {open && (
        <div id={`profile-group-${id}`} className="border-t border-ink-200/70 px-4 py-4 sm:px-5 sm:py-5">
          {children}
        </div>
      )}
    </section>
  );
}
