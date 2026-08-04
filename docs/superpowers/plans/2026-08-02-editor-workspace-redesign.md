# Editor Workspace Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the four writing-tool screens as a two-pane professional editor with toolbar dropdowns, delete every UI element backed by fabricated data, and make the account surfaces honest about what they persist.

**Architecture:** A `Editor` (toolbar + textarea + action bar) sits left, a `ResultsPane` right, in a CSS grid that collapses to a single column below 80rem. The third column (`RightPanel`) is dissolved: request parameters move into the toolbar as Radix-backed dropdowns, real grammar corrections move into the results pane, and everything else in it was rendering invented values and is deleted.

**Tech Stack:** React 19, React Router 7, Tailwind v4, Radix UI (`radix-ui@1.6.4`, already a dependency), lucide-react, Vite.

**Spec:** [`docs/superpowers/specs/2026-08-02-editor-workspace-redesign-design.md`](../specs/2026-08-02-editor-workspace-redesign-design.md)

## Global Constraints

- **Working directory for every command:** `apps/web-app`.
- **No test runner exists in this project.** Per spec §10, the verification gate for every task is `npm run build` (must stay clean) and `npm run lint` (must not exceed the baseline). This is weaker than TDD; establishing Vitest is deferred in spec §11. Do not silently add a test framework mid-plan.
- **Lint baseline: 12 errors, 1 warning.** Any task that pushes it above that has introduced a regression and must be fixed before commit. Deleting files may reduce the count — that is fine and expected.
- **Backend text limit is 10,000 characters** on all four tool schemas (`grammar.py`, `style.py`, `summarizer.py`, `headline.py`). The client cap must be exactly `10000`.
- **No backend changes.** No file under `apps/backend-api/` is touched by this plan.
- **Radix Select values are strings.** Option `id`s that are numbers (headline count) must be stringified into Radix and mapped back on change.
- **Sinhala stays in content, placeholders and results.** Only *control labels* become single-language (spec §6).
- Commit after each task with the message given in that task's final step.

---

### Task 1: Shared option lists and the Dropdown component

Foundation only — no visible change. `RightPanel` is repointed at the extracted lists to prove the extraction is faithful.

**Files:**
- Create: `src/lib/toolOptions.js`
- Create: `src/components/ui/Dropdown.jsx`
- Modify: `src/components/RightPanel.jsx` (delete inline option consts, import them instead)

**Interfaces:**
- Produces: `TONES`, `LENGTHS`, `SUMMARY_VIEWS`, `HEADLINE_LENGTHS_OPTIONS`, `HEADLINE_COUNTS`, `HEADLINE_CATEGORIES` from `lib/toolOptions.js`. Each is `Array<{ id: string|number, label: string, desc?: string, words?: string }>`.
- Produces: `Dropdown` default export from `ui/Dropdown.jsx` with props `{ id?, label, value, onChange, options, variant?: 'compact'|'full', className? }`. `onChange` receives the option's original `id` (number preserved, not the stringified Radix value).

- [ ] **Step 1: Create `src/lib/toolOptions.js`**

Lifted verbatim from `RightPanel.jsx` lines 12-60 so behaviour cannot drift.

```js
/**
 * Option lists for the writing tools' request parameters.
 *
 * Single source shared by the editor toolbar and the Settings page. Every
 * value here is accepted by the corresponding backend endpoint — headline
 * `style` is deliberately absent because services/api.js does not send it.
 */

export const TONES = [
  { id: 'formal', label: 'Formal', desc: 'Broadsheet news desk voice' },
  { id: 'editorial', label: 'Editorial', desc: 'Analytical opinion writing' },
  { id: 'sports', label: 'Sports', desc: 'Fast, energetic sports desk' },
  { id: 'feature', label: 'Feature', desc: 'Narrative long-form style' },
  { id: 'youth', label: 'Youth', desc: 'Casual, social-media friendly' },
];

export const LENGTHS = [
  { id: 'short', label: 'Short', desc: 'Brief summary (~10% length)' },
  { id: 'medium', label: 'Medium', desc: 'Standard summary (~20% length)' },
  { id: 'long', label: 'Long', desc: 'Detailed summary (~35% length)' },
];

export const SUMMARY_VIEWS = [
  { id: 'paragraph', label: 'Paragraph' },
  { id: 'bullets', label: 'Bullets' },
];

// Word bands, mirroring HEADLINE_LENGTHS in the backend's app/core/prompts.py.
// Non-overlapping, so a headline's word count maps to exactly one band.
export const HEADLINE_LENGTHS_OPTIONS = [
  { id: 'short', label: 'Short', desc: '3–5 words' },
  { id: 'medium', label: 'Medium', desc: '6–7 words' },
  { id: 'long', label: 'Long', desc: '8–10 words' },
];

export const HEADLINE_COUNTS = [
  { id: 3, label: '3 headlines' },
  { id: 5, label: '5 headlines' },
  { id: 7, label: '7 headlines' },
];

export const HEADLINE_CATEGORIES = [
  { id: 'General', label: 'General' },
  { id: 'Politics', label: 'Politics' },
  { id: 'Business', label: 'Business' },
  { id: 'Sports', label: 'Sports' },
  { id: 'Entertainment', label: 'Entertainment' },
  { id: 'Tech', label: 'Tech' },
  { id: 'World', label: 'World' },
];
```

- [ ] **Step 2: Create `src/components/ui/Dropdown.jsx`**

```jsx
import { Select } from 'radix-ui';
import { Check, ChevronDown } from 'lucide-react';

/**
 * Styled wrapper over Radix Select.
 *
 * Radix supplies the listbox pattern, keyboard navigation, focus return,
 * outside-click dismissal and collision-aware positioning; this file adds
 * only SinAi styling and the { id, label, desc } option shape used across
 * the app. Content is portalled so the popover escapes the editor pane's
 * overflow instead of being clipped by it.
 *
 * Radix works in strings, so numeric ids (headline count) are stringified
 * on the way in and mapped back to their original type on the way out —
 * callers keep receiving the number they put in.
 */
export default function Dropdown({
  id,
  label,
  value,
  onChange,
  options,
  variant = 'compact',
  className = '',
}) {
  const compact = variant === 'compact';
  const selected = options.find((o) => String(o.id) === String(value));

  const handleChange = (next) => {
    const match = options.find((o) => String(o.id) === next);
    onChange(match ? match.id : next);
  };

  return (
    <Select.Root value={value == null ? undefined : String(value)} onValueChange={handleChange}>
      <Select.Trigger
        id={id}
        aria-label={label}
        className={`
          inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white
          text-ink-700 font-medium cursor-pointer transition-colors duration-150
          hover:border-ink-300 hover:text-ink-900
          focus:outline-none focus:border-brand-400 focus:shadow-[0_0_0_3px_rgba(205,25,26,0.07)]
          data-[state=open]:border-brand-400
          ${compact ? 'px-2.5 py-1.5 text-[12px]' : 'w-full justify-between px-3.5 py-2.5 text-[14px]'}
          ${className}
        `}
      >
        {compact && (
          <span className="text-ink-400 font-semibold uppercase tracking-wider text-[9.5px]">
            {label}
          </span>
        )}
        <Select.Value placeholder={label}>{selected?.label}</Select.Value>
        <Select.Icon className="text-ink-400">
          <ChevronDown size={13} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          position="popper"
          sideOffset={6}
          className="z-50 min-w-[var(--radix-select-trigger-width)] max-h-[18rem] overflow-hidden
            rounded-xl border border-ink-200/80 bg-white shadow-pop
            animate-in fade-in slide-in-from-top-1 duration-150"
        >
          <Select.Viewport className="p-1">
            {options.map((option) => (
              <Select.Item
                key={option.id}
                value={String(option.id)}
                className="relative flex flex-col gap-0.5 rounded-lg px-3 py-2 pr-8 cursor-pointer
                  text-[13px] text-ink-700 select-none outline-none
                  data-[highlighted]:bg-ink-50 data-[highlighted]:text-ink-900
                  data-[state=checked]:text-brand-700 data-[state=checked]:font-semibold"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                {!compact && option.desc && (
                  <span className="text-[11px] text-ink-400 font-normal">{option.desc}</span>
                )}
                <Select.ItemIndicator className="absolute right-2.5 top-2.5 text-brand-600">
                  <Check size={13} strokeWidth={3} />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
```

- [ ] **Step 3: Repoint `RightPanel.jsx` at the extracted lists**

Delete lines 10-60 of `src/components/RightPanel.jsx` (the `// ─── Option definitions ───` block through the end of `HEADLINE_CATEGORIES`) and add this import below the existing `Skeleton` import:

```jsx
import {
  TONES, LENGTHS, SUMMARY_VIEWS, HEADLINE_LENGTHS_OPTIONS,
} from '../lib/toolOptions';
```

Then change the one place that reads the removed `words` key — in the headlines branch, replace:

```jsx
{HEADLINE_LENGTHS_OPTIONS.find((o) => o.id === settings.headlineLength)?.words}
```

with:

```jsx
{HEADLINE_LENGTHS_OPTIONS.find((o) => o.id === settings.headlineLength)?.desc}
```

`HEADLINE_STYLES`, `HEADLINE_COUNTS` and `HEADLINE_CATEGORIES` were never rendered here, so they are simply gone from this file — `HEADLINE_COUNTS` and `HEADLINE_CATEGORIES` now live in `toolOptions.js` for Task 3, and `HEADLINE_STYLES` is dropped entirely (spec D12).

- [ ] **Step 4: Verify build and lint**

Run: `npm run build`
Expected: `✓ built in …`, no errors.

Run: `npm run lint`
Expected: `✖ 13 problems (12 errors, 1 warning)` — unchanged from baseline.

- [ ] **Step 5: Commit**

```bash
git add src/lib/toolOptions.js src/components/ui/Dropdown.jsx src/components/RightPanel.jsx
git commit -m "feat(web): extract tool option lists and add Radix-backed Dropdown"
```

---

### Task 2: Delete the fabricated headline analytics

Removes every UI element rendered from values `services/api.js` invents. No layout work — this task is only subtraction, and is reviewable on its own.

**Files:**
- Modify: `src/services/api.js` (`generateHeadlines`)
- Modify: `src/components/HeadlineOutputPanel.jsx`
- Modify: `src/components/RightPanel.jsx` (delete `HeadlineInsightsPanel`)

**Interfaces:**
- Produces: `generateHeadlines()` now resolves to `{ headlines: string[], best_headline: string|null, candidates: Array<{ headline, rank, word_count, length_ok }>, length: { id?, min_words, max_words }, id?, model_used? }`. Tasks 3-6 rely on `candidates[].word_count` and `candidates[].length_ok` existing and on `source_entities` / `pipeline_log` / `metrics` being **gone**.

- [ ] **Step 1: Simplify `generateHeadlines` in `src/services/api.js`**

Replace the whole body from `const band = raw.length || …` through the closing `};` of the returned object with:

```js
  const band = raw.length || HEADLINE_LENGTH_BANDS[length] || HEADLINE_LENGTH_BANDS.medium;

  // Only two derived values, both computed from text the backend actually
  // returned: the word count and whether it landed in the requested band.
  // Everything else this function used to synthesize — validation flags,
  // ROUGE/BLEU/semantic scores, entities, themes, a pipeline log — was
  // invented client-side and rendered as if the model had produced it.
  const headlines = raw.headlines || [];
  const candidates = headlines.map((headline, i) => {
    const words = headline.trim().split(/\s+/).length;
    return {
      headline,
      rank: i + 1,
      word_count: words,
      length_ok: words >= band.min_words && words <= band.max_words,
    };
  });

  return {
    ...raw,
    best_headline: headlines[0] || null,
    candidates,
  };
}
```

- [ ] **Step 2: Strip `HeadlineOutputPanel.jsx`**

Delete, in this order:

1. The `MetricBar` function (lines 14-34) and the `Badge` function (lines 36-47).
2. The `ENTITY_COLORS` const and `EntityTag` function (lines 111-130).
3. Inside `CandidateCard`: the `const m = candidate.metrics ?? {}` and `hasRealMetrics` lines, the whole `<div className="flex items-center gap-1.5 mt-2 flex-wrap">…</div>` badge row, the `ChevronUp`/`ChevronDown` expansion affordance, and the entire `{isExpanded && hasRealMetrics && (…)}` block. `CandidateCard` loses its `isExpanded`/`onToggle` props.
4. In the main export: the `expandedIdx`, `showEntities`, `showPipeline` state; the `entities`, `semantics`, `pipelineLog` consts; the regeneration badge in the section header; and the Entities, Key-themes and Pipeline-log `<Card>` blocks near the end.
5. Trim the `lucide-react` import to only what survives: `AlertTriangle, Sparkles, Camera, RefreshCw, Loader2, ImageOff, Edit3, FileSearch, Wand2, Download, ExternalLink, ImageIcon, ChevronDown, ChevronUp` (the last two are still used by `VisualPromptModule`'s collapse toggle).

`CandidateCard` becomes:

```jsx
function CandidateCard({ candidate }) {
  const isBest = candidate.rank === 1;

  return (
    <Card className={`transition-all duration-200 ${isBest ? 'border-emerald-200/80' : 'hover:border-ink-300'}`}>
      <div className="w-full flex items-start gap-3 px-4 py-3.5 text-left">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-[12px] font-bold tabular-nums
          ${isBest ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>
          {isBest ? <Trophy size={13} /> : candidate.rank}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`text-[15px] leading-relaxed ${isBest ? 'font-semibold text-ink-900' : 'text-ink-800'}`}>
            {candidate.headline}
          </p>
          <p className="text-[11px] text-ink-400 mt-1.5 tabular-nums">
            {candidate.word_count} word{candidate.word_count !== 1 ? 's' : ''}
            {candidate.length_ok ? '' : ' · outside requested band'}
          </p>
        </div>

        <CopyButton text={candidate.headline} label="" className="!px-1.5 shrink-0 mt-0.5" />
      </div>
    </Card>
  );
}
```

and its call site becomes `<CandidateCard key={i} candidate={c} />`. Keep `Trophy` in the import list.

- [ ] **Step 3: Delete `HeadlineInsightsPanel` from `RightPanel.jsx`**

Remove the entire `HeadlineInsightsPanel` function and, in the headlines branch of the default export, collapse the conditional so the controls card always renders:

```jsx
  // headlines
  return (
    <>
      <RightPanelCard icon={Newspaper} title="Headline controls">
        <OptionChips
          label="Max length"
          options={HEADLINE_LENGTHS_OPTIONS}
          value={settings.headlineLength}
          onChange={(v) => onSettingsChange({ ...settings, headlineLength: v })}
        />
        <p className="-mt-3.5 text-[11px] text-ink-500">
          {HEADLINE_LENGTHS_OPTIONS.find((o) => o.id === settings.headlineLength)?.desc}
        </p>
      </RightPanelCard>
    </>
  );
```

Trim `RightPanel`'s `lucide-react` import: drop `BarChart3`, `Tag`, `Sparkles`, `AlertTriangle`. (This whole file is deleted in Task 4; keeping it valid here keeps the tree building between commits.)

- [ ] **Step 4: Verify build and lint**

Run: `npm run build` → clean.
Run: `npm run lint` → **12 errors or fewer**. Deleting the metrics code removes one `react-hooks` violation site, so a drop is expected and fine; an increase is not.

- [ ] **Step 5: Commit**

```bash
git add src/services/api.js src/components/HeadlineOutputPanel.jsx src/components/RightPanel.jsx
git commit -m "refactor(web): remove headline analytics the backend never produced"
```

---

### Task 3: Editor and EditorToolbar

Replaces `InputBox`. Controls appear in the toolbar; `RightPanel` keeps rendering its own copies for one commit so the app stays working, and loses them in Task 4.

**Files:**
- Create: `src/components/editor/EditorToolbar.jsx`
- Create: `src/components/editor/Editor.jsx`
- Modify: `src/App.jsx` (`ToolRunner` uses `Editor`; `TOOL_CONFIG` loses `sample`; defaults gain `category`)
- Modify: `src/lib/toolMeta.js` (drop `sample` and `sampleLabel`)
- Delete: `src/components/InputBox.jsx`

**Interfaces:**
- Consumes: `Dropdown` (Task 1), `toolOptions` lists (Task 1).
- Produces: `Editor` default export, props `{ tool, title, icon, placeholder, actionLabel, helper, value, onChange, onRun, onClear, loading, settings, onSettingsChange }`.
- Produces: `MAX_CHARS = 10000` exported from `editor/Editor.jsx`.
- Produces: `TOOLBAR_CONTROLS` from `editor/EditorToolbar.jsx`, mapping tool id → array of `{ key, label, options }`.

- [ ] **Step 1: Create `src/components/editor/EditorToolbar.jsx`**

```jsx
import Dropdown from '../ui/Dropdown';
import {
  TONES, LENGTHS, HEADLINE_LENGTHS_OPTIONS, HEADLINE_COUNTS, HEADLINE_CATEGORIES,
} from '../../lib/toolOptions';

/**
 * Request parameters only — one dropdown per value the tool actually sends
 * to the backend. Display options (e.g. the summarizer's paragraph/bullets
 * toggle) live on the results pane instead, because they do not change the
 * request. Grammar has no entry: POST /grammar/check takes only `text`.
 */
export const TOOLBAR_CONTROLS = {
  grammar: [],
  headlines: [
    { key: 'headlineLength', label: 'Length', options: HEADLINE_LENGTHS_OPTIONS },
    { key: 'count', label: 'Count', options: HEADLINE_COUNTS },
    { key: 'category', label: 'Category', options: HEADLINE_CATEGORIES },
  ],
  rewriter: [{ key: 'tone', label: 'Tone', options: TONES }],
  summarizer: [{ key: 'length', label: 'Length', options: LENGTHS }],
};

export default function EditorToolbar({
  tool, title, icon: Icon, charCount, maxChars, isOverLimit, isNearLimit,
  settings, onSettingsChange,
}) {
  const controls = TOOLBAR_CONTROLS[tool] ?? [];

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-ink-100 flex-wrap">
      <span className="flex items-center gap-2 pl-1 pr-1 shrink-0">
        {Icon && <Icon size={15} className="text-brand-600" strokeWidth={2.25} />}
        <span className="text-[13px] font-bold text-ink-800 tracking-tight">{title}</span>
      </span>

      {controls.length > 0 && (
        <span className="h-4 w-px bg-ink-200 mx-0.5 hidden sm:block" aria-hidden="true" />
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {controls.map(({ key, label, options }) => (
          <Dropdown
            key={key}
            id={`toolbar-${key}`}
            label={label}
            options={options}
            value={settings[key]}
            onChange={(v) => onSettingsChange({ ...settings, [key]: v })}
          />
        ))}
      </div>

      <span
        className={`ml-auto text-[11px] font-medium tabular-nums whitespace-nowrap pr-1 ${
          isOverLimit ? 'text-brand-600 font-semibold' : isNearLimit ? 'text-amber-600' : 'text-ink-400'
        }`}
        aria-live="polite"
      >
        {charCount.toLocaleString()} / {maxChars.toLocaleString()}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/editor/Editor.jsx`**

```jsx
import { useState } from 'react';
import { Eraser, Play } from 'lucide-react';
import ActionButton from '../ui/ActionButton';
import CopyButton from '../ui/CopyButton';
import EditorToolbar from './EditorToolbar';

// Matches max_length on every tool request schema in apps/backend-api
// (grammar.py, style.py, summarizer.py, headline.py). The client used to
// cap at 2,000 — roughly 300 Sinhala words — well below the article
// lengths the summarizer and headline generator exist to handle.
export const MAX_CHARS = 10000;

export default function Editor({
  tool, title, icon, placeholder, actionLabel = 'Run', helper,
  value, onChange, onRun, onClear, loading = false,
  settings, onSettingsChange,
}) {
  const [focused, setFocused] = useState(false);

  const charCount = value?.length ?? 0;
  const isNearLimit = charCount > MAX_CHARS * 0.85;
  const isOverLimit = charCount > MAX_CHARS;

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      onRun?.();
    }
  };

  return (
    <div
      className={`
        relative flex flex-col min-h-0 rounded-2xl border bg-white transition-all duration-200
        ${focused
          ? 'border-brand-400 shadow-[0_0_0_3px_rgba(205,25,26,0.07)]'
          : 'border-ink-200/80 shadow-card hover:border-ink-300'}
      `}
    >
      <EditorToolbar
        tool={tool}
        title={title}
        icon={icon}
        charCount={charCount}
        maxChars={MAX_CHARS}
        isOverLimit={isOverLimit}
        isNearLimit={isNearLimit}
        settings={settings}
        onSettingsChange={onSettingsChange}
      />

      <textarea
        id="input-box"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        disabled={loading}
        maxLength={MAX_CHARS + 50}
        aria-label={`${title} input`}
        className="flex-1 min-h-[18rem] xl:min-h-[20rem] w-full px-4 py-3.5 text-[15px]
          text-ink-800 placeholder:text-ink-400 bg-transparent border-none
          focus:outline-none focus:ring-0 resize-none leading-[1.8] font-sans
          disabled:cursor-not-allowed"
      />

      <div className="flex items-center gap-2 px-3 py-2.5 border-t border-ink-100 shrink-0">
        {helper && (
          <span className="hidden md:block text-[11px] text-ink-400 truncate pl-1">{helper}</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <CopyButton text={value} label="Copy" className={!value ? 'opacity-40 pointer-events-none' : ''} />
          <ActionButton id="btn-clear" size="sm" variant="ghost" icon={Eraser} onClick={onClear} disabled={loading || !value}>
            Clear
          </ActionButton>
          <ActionButton
            id="btn-run"
            size="md"
            variant="primary"
            icon={Play}
            onClick={onRun}
            loading={loading}
            disabled={loading || !value?.trim() || isOverLimit}
            title="Ctrl+Enter"
          >
            {actionLabel}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire `Editor` into `App.jsx`**

In `src/App.jsx`:

1. Replace the `InputBox` import with `import Editor from './components/editor/Editor';`
2. In `TOOL_CONFIG`, delete every `sample:` line (four of them).
3. In `loadDefaultSettings()`, add `category: 'General',` to the returned object (the headline Category dropdown needs a defined starting value).
4. In `ToolRunner`, replace the `<InputBox … />` element with:

```jsx
          <Editor
            tool={activeTool}
            title={config.title}
            icon={config.icon}
            placeholder={config.placeholder}
            actionLabel={config.actionLabel}
            helper={config.helper}
            value={input}
            onChange={setInput}
            onRun={handleRun}
            onClear={clear}
            loading={loading}
            settings={settings}
            onSettingsChange={setSettings}
          />
```

5. In `handleRun`'s `headlines` case, drop the unsupported `style` argument:

```jsx
      case 'headlines':
        wrappedProcess((text) =>
          generateHeadlines(text, {
            length: settings.headlineLength,
            numCandidates: settings.count,
            category: settings.category || 'General',
          })
        );
        break;
```

Note `length` is now passed — it previously was not, so the band dropdown had no effect on the request at all.

- [ ] **Step 4: Strip samples from `src/lib/toolMeta.js`**

Delete the `sampleLabel` and `sample` keys from all four entries. Each entry keeps only `id`, `label`, `shortDesc`, `icon` — still consumed by the dashboard tool grid, the history feed and the sidebar. `TOOL_LIST` stays exported.

The grammar entry, for example, becomes:

```js
  grammar: {
    id: 'grammar',
    label: 'Grammar Checker',
    shortDesc: 'Fix Sinhala spelling, grammar, and agreement issues.',
    icon: SpellCheck,
  },
```

Apply the same removal to `headlines`, `rewriter` and `summarizer`.

- [ ] **Step 5: Delete `InputBox.jsx`**

```bash
git rm src/components/InputBox.jsx
```

- [ ] **Step 6: Verify build and lint**

Run: `npm run build` → clean.
Run: `npm run lint` → ≤ 12 errors.

Note: `Dashboard.jsx` still destructures `sampleLabel`/`sample` from `TOOL_LIST` at this point; they resolve to `undefined` rather than throwing, so the build stays green. Task 7 removes that block.

- [ ] **Step 7: Manual check**

Run `npm run dev`, open `/rewriter`. Expect: a Tone dropdown in the editor toolbar that opens on click and on keyboard (Tab to it, press Enter, arrow, Enter). Changing it and running produces a differently-toned result. On `/headlines`, three dropdowns appear and `Count` changes how many headlines come back.

- [ ] **Step 8: Commit**

```bash
git add -A src/components/editor src/App.jsx src/lib/toolMeta.js src/components/InputBox.jsx
git commit -m "feat(web): editor with toolbar controls, 10k char cap, no sample button"
```

---

### Task 4: Results pane, corrections relocation, apply-to-editor

Dissolves `RightPanel`. Real grammar corrections move into the results pane; the apply-result-to-editor loop is closed.

**Files:**
- Create: `src/components/editor/ResultsPane.jsx`
- Modify: `src/components/OutputPanel.jsx` (accept and render the corrections list)
- Modify: `src/App.jsx` (`ToolRunner` composes `ResultsPane`, provides apply)
- Delete: `src/components/RightPanel.jsx`

**Interfaces:**
- Consumes: `Dropdown` (Task 1), `SUMMARY_VIEWS` (Task 1).
- Produces: `ResultsPane` default export, props `{ title, right, children }` — `right` is a node rendered at the header's trailing edge.
- Produces: `OutputPanel` gains prop `showCorrections: boolean` (default `false`); when true and corrections exist it renders the relocated breakdown beneath the result.

- [ ] **Step 1: Create `src/components/editor/ResultsPane.jsx`**

```jsx
/**
 * Right-hand pane shell: a sticky header carrying the result label and any
 * display-only controls, over an independently scrolling body.
 *
 * Display options live here rather than in the editor toolbar because they
 * change how a result is shown, not what was requested (spec D2).
 */
export default function ResultsPane({ title, right, children }) {
  return (
    <div className="flex flex-col min-h-0 xl:h-full">
      <div className="flex items-center gap-2 pb-2.5 shrink-0">
        <span className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.14em]">
          {title}
        </span>
        {right && <span className="ml-auto flex items-center gap-1.5">{right}</span>}
      </div>
      <div className="flex-1 min-h-0 xl:overflow-y-auto xl:pr-1">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Add the corrections list to `OutputPanel.jsx`**

Add to the top of the file, after the existing imports:

```jsx
import { Layers } from 'lucide-react';

// Relocated from the deleted RightPanel. These corrections are real —
// derived server-side by grammar_service.derive_corrections() — unlike the
// headline "metrics" removed in the same redesign.
const RULE_META = {
  spelling: { label: 'Spelling', dot: 'bg-brand-400', bar: 'bg-brand-400' },
  grammar: { label: 'Grammar', dot: 'bg-orange-400', bar: 'bg-orange-400' },
  word_order: { label: 'Word Order', dot: 'bg-purple-400', bar: 'bg-purple-400' },
  punctuation: { label: 'Punctuation', dot: 'bg-amber-400', bar: 'bg-amber-400' },
  agreement: { label: 'Agreement', dot: 'bg-blue-400', bar: 'bg-blue-400' },
  style: { label: 'Style', dot: 'bg-teal-400', bar: 'bg-teal-400' },
};

function resolveRule(rule = '') {
  const lower = rule.toLowerCase();
  if (lower.includes('spell')) return RULE_META.spelling;
  if (lower.includes('word_order') || lower.includes('order')) return RULE_META.word_order;
  if (lower.includes('punct')) return RULE_META.punctuation;
  if (lower.includes('agreement') || lower.includes('concord')) return RULE_META.agreement;
  if (lower.includes('style')) return RULE_META.style;
  return RULE_META.grammar;
}

function CorrectionsList({ corrections }) {
  if (!corrections.length) return null;

  const breakdown = {};
  corrections.forEach((c) => {
    const meta = resolveRule(c.rule);
    breakdown[meta.label] = breakdown[meta.label] || { count: 0, meta };
    breakdown[meta.label].count += 1;
  });
  const entries = Object.entries(breakdown);

  return (
    <Card className="px-4 py-4 space-y-4">
      {entries.length > 1 && (
        <div>
          <p className="text-[10px] font-bold text-ink-500 uppercase tracking-[0.12em] mb-2 flex items-center gap-1.5">
            <Layers size={10} /> By category
          </p>
          <div className="space-y-1.5">
            {entries.map(([label, { count, meta }]) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                <span className="text-[11.5px] text-ink-600 flex-1">{label}</span>
                <div className="w-20 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${meta.bar}`}
                    style={{ width: `${Math.round((count / corrections.length) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-ink-600 w-3 text-right tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[10px] font-bold text-ink-500 uppercase tracking-[0.12em] mb-2">
          Corrections applied
        </p>
        <div className="space-y-1.5">
          {corrections.map((c, i) => {
            const meta = resolveRule(c.rule);
            return (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2.5 bg-ink-50/70 border border-ink-100 rounded-xl">
                <div className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${meta.dot}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[12px] text-ink-400 line-through decoration-brand-300">{c.original}</span>
                    <span className="text-ink-300 text-[10px]">→</span>
                    <span className="text-[12px] font-semibold text-ink-800">{c.corrected}</span>
                  </div>
                  <p className="text-[10px] text-ink-500 mt-0.5 uppercase tracking-wide">{meta.label}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
```

Change the signature to accept the new prop:

```jsx
export default function OutputPanel({ output, loading, error, type, input, summaryView = 'paragraph', showCorrections = false }) {
```

and render the list immediately before the closing `SinAi can make mistakes` paragraph:

```jsx
      {showCorrections && <CorrectionsList corrections={corrections} />}
```

- [ ] **Step 3: Compose `ResultsPane` in `App.jsx`**

Add imports:

```jsx
import ResultsPane from './components/editor/ResultsPane';
import Dropdown from './components/ui/Dropdown';
import { SUMMARY_VIEWS } from './lib/toolOptions';
```

In `ToolRunner`, above the `return`:

```jsx
  const resultText = output?.corrected ?? output?.rewritten ?? output?.summary ?? '';
  const canApply = Boolean(resultText) && activeTool !== 'headlines';

  const resultsTitle = activeTool === 'headlines' ? 'Generated headlines' : 'Result';
  const resultsControls = (
    <>
      {activeTool === 'summarizer' && output && (
        <Dropdown
          id="summary-view"
          label="View"
          options={SUMMARY_VIEWS}
          value={settings.summaryView}
          onChange={(v) => setSettings({ ...settings, summaryView: v })}
        />
      )}
      {canApply && (
        <ActionButton size="sm" variant="ghost" icon={ArrowDownToLine} onClick={() => setInput(resultText)}>
          Apply
        </ActionButton>
      )}
    </>
  );
```

Add `ArrowDownToLine` to the `lucide-react` import in `App.jsx` and import `ActionButton` from `./components/ui/ActionButton`.

Then wrap the output element:

```jsx
        <div className="tg-output">
          <ResultsPane title={resultsTitle} right={resultsControls}>
            {activeTool === 'headlines' ? (
              <HeadlineOutputPanel output={output} loading={loading} error={error} articleText={input} />
            ) : (
              <OutputPanel
                output={output}
                loading={loading}
                error={error}
                type={config.outputType}
                activeTool={activeTool}
                input={input}
                summaryView={settings.summaryView}
                showCorrections={activeTool === 'grammar'}
              />
            )}
          </ResultsPane>
        </div>
```

Finally delete the entire `<div className="tg-panel">…</div>` block and the `RightPanel` import.

- [ ] **Step 4: Delete `RightPanel.jsx`**

```bash
git rm src/components/RightPanel.jsx
```

- [ ] **Step 5: Verify build and lint**

Run: `npm run build` → clean.
Run: `npm run lint` → ≤ 12 errors (expect a drop; `RightPanel` held lint violations).

- [ ] **Step 6: Manual check**

`/grammar` with text containing an error: corrections list appears under the result, and **Apply** replaces the editor content with the corrected text. `/summarizer`: the View dropdown appears in the results header only after a result exists and switches paragraph/bullets.

- [ ] **Step 7: Commit**

```bash
git add -A src/components/editor src/components/OutputPanel.jsx src/App.jsx src/components/RightPanel.jsx
git commit -m "feat(web): results pane with relocated corrections and apply-to-editor"
```

---

### Task 5: Two-pane layout

**Files:**
- Modify: `src/index.css` (replace `.tool-grid` rules)
- Modify: `src/App.jsx` (full-height editor routes, drop `PageHeader`, widen container)

- [ ] **Step 1: Replace the grid rules in `src/index.css`**

Replace the whole block from `/* ── Tool workspace grid:` through the closing `}` of the `@media (min-width: 80rem)` rule with:

```css
/* ── Tool workspace: editor left, results right.
     Below 80rem the two stack and the page scrolls normally; at and above
     it each pane is full height and scrolls independently. ── */
.tool-workspace {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: minmax(0, 1fr);
}
.tool-workspace > .tw-editor,
.tool-workspace > .tw-results { min-width: 0; }

@media (min-width: 80rem) {
  .tool-workspace {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.5rem;
    flex: 1;
    min-height: 0;
  }
  .tool-workspace > .tw-editor,
  .tool-workspace > .tw-results { min-height: 0; }
}
```

- [ ] **Step 2: Update `App.jsx` layout**

1. Replace `const isChat = false;` with:

```jsx
  const EDITOR_TOOLS = ['grammar', 'headlines', 'rewriter', 'summarizer'];
  const isEditor = EDITOR_TOOLS.includes(activeTool);
```

(define `EDITOR_TOOLS` at module scope, above `function App()`, not inside it.)

2. In `MAX_WIDTHS`, change the four tool entries from `max-w-7xl` to `max-w-[1600px]`.

3. Change the `<main>` and inner container classes to:

```jsx
        <main className={`flex-1 min-h-0 overflow-y-auto ${isEditor ? 'xl:overflow-hidden xl:flex xl:flex-col' : ''}`}>
          <div
            key={location.pathname}
            className={`mx-auto w-full ${MAX_WIDTHS[activeTool] ?? 'max-w-5xl'} px-4 sm:px-6 lg:px-8 py-6 lg:py-8
              animate-in fade-in slide-in-from-bottom-2 duration-300
              ${isEditor ? 'xl:flex-1 xl:min-h-0 xl:flex xl:flex-col' : ''}`}
          >
```

4. In `ToolRunner`, delete the `<PageHeader … />` element and its import if unused elsewhere in the file (it is not — `PageHeader` is only used by `ToolRunner` here), and drop the now-unused `StatusBadge` import. Replace the grid classes:

```jsx
    <div className="tool-workspace">
      <div className="tw-editor flex flex-col min-h-0">
        <Editor … />
      </div>
      <div className="tw-results flex flex-col min-h-0">
        <ResultsPane …>…</ResultsPane>
      </div>
    </div>
```

removing the old `<div className="tg-input">` / `tg-output` wrappers and the `<>…</>` fragment that held `PageHeader`.

- [ ] **Step 3: Verify build and lint**

Run: `npm run build` → clean.
Run: `npm run lint` → ≤ 12 errors.

- [ ] **Step 4: Manual check at both breakpoints**

At ≥1280px wide: editor and results side by side, both full height, results scroll without moving the editor, no page scrollbar. Below 1280px: single column, editor above results, page scrolls.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/App.jsx
git commit -m "feat(web): two-pane full-height editor workspace"
```

---

### Task 6: Responsive visual prompt and image

**Files:**
- Modify: `src/components/HeadlineOutputPanel.jsx` (`VisualPromptModule`)

- [ ] **Step 1: Restructure the module body**

Inside `VisualPromptModule`'s open state, replace the prompt textarea block and the image display block with a two-column grid that stacks on narrow panes, and give the image a fixed aspect ratio so the layout does not jump between skeleton, image and error:

```jsx
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
            {/* Prompt column */}
            <div className="space-y-2 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 min-w-0 text-[11px] text-ink-500 font-medium">
                  <Edit3 size={11} className="text-ink-400 shrink-0" />
                  <span className="truncate">English image prompt — edit before generating</span>
                </span>
                {prompt && <CopyButton text={prompt} />}
              </div>

              {loading ? (
                <Skeleton className="h-28 rounded-lg" />
              ) : (
                <textarea
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value); setImageData(null); setImgError(null); }}
                  rows={5}
                  className="w-full px-3 py-2.5 text-[13px] text-ink-700 bg-ink-50 border border-ink-200
                    rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-brand-200
                    focus:border-brand-300 leading-relaxed font-mono"
                  placeholder={error ? 'Prompt generation failed — see below.' : 'Visual prompt will appear here…'}
                  aria-label="Visual prompt"
                />
              )}

              <div className="flex items-center gap-1.5">
                <ActionButton variant="secondary" size="sm" icon={RefreshCw} onClick={() => generate()} disabled={loading || !articleText}>
                  Regenerate
                </ActionButton>
                {prompt && !loading && (
                  <ActionButton variant="primary" size="sm" icon={imgLoading ? Loader2 : Wand2} onClick={handleGenerateImage} disabled={imgLoading}>
                    {imgLoading ? 'Generating…' : 'Generate image'}
                  </ActionButton>
                )}
              </div>
            </div>

            {/* Image column */}
            <div className="min-w-0">
              {imgLoading && <Skeleton className="w-full aspect-[16/10] rounded-xl" />}

              {imageData && !imgLoading && (
                <div className="relative group rounded-xl overflow-hidden border border-ink-200 bg-ink-100 aspect-[16/10] animate-in fade-in duration-300">
                  <img src={imageData} alt="AI-generated news image" className="w-full h-full object-cover" />
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <a
                      href={imageData} target="_blank" rel="noopener noreferrer" title="Open full size"
                      className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur flex items-center justify-center text-ink-600 hover:text-ink-900"
                    >
                      <ExternalLink size={13} />
                    </a>
                    <a
                      href={imageData} download="sinai-image.png" title="Download"
                      className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur flex items-center justify-center text-ink-600 hover:text-ink-900"
                    >
                      <Download size={13} />
                    </a>
                  </div>
                </div>
              )}

              {!imageData && !imgLoading && (
                <div className="w-full aspect-[16/10] rounded-xl border border-dashed border-ink-300/70 flex flex-col items-center justify-center gap-1.5 text-center px-4">
                  <ImageIcon size={18} className="text-ink-300" />
                  <p className="text-[11.5px] text-ink-400">
                    {prompt ? 'Generate an image from the prompt' : 'A prompt is generated from your article first'}
                  </p>
                </div>
              )}
            </div>
          </div>
```

Keep the two existing error blocks (`imgError` and `error`) below this grid, unchanged apart from replacing their bilingual "නැවත උත්සාහ කරන්න / Retry" labels with `Retry`.

- [ ] **Step 2: Verify build and lint**

Run: `npm run build` → clean.
Run: `npm run lint` → ≤ 12 errors.

- [ ] **Step 3: Manual check**

`/headlines` with an article: prompt and image placeholder sit side by side in the results pane at ≥1280px, stack below `md`. Generating an image does not shift the layout (the placeholder and the image occupy the same box).

- [ ] **Step 4: Commit**

```bash
git add src/components/HeadlineOutputPanel.jsx
git commit -m "feat(web): responsive visual prompt and image layout"
```

---

### Task 7: Dashboard

**Files:**
- Modify: `src/components/Dashboard.jsx`

- [ ] **Step 1: Fix the broken quick actions**

`onSelectTool('comparison')` and `onSelectTool('sinllama')` navigate to routes that redirect straight back to `/dashboard` — they moved to `/admin/research/*` in Phase 4. Replace the Quick-actions array with actions that work:

```jsx
              {[
                { label: 'Check Sinhala grammar', icon: SpellCheck, action: () => onSelectTool('grammar') },
                { label: 'Generate headlines', icon: Newspaper, action: () => onSelectTool('headlines') },
                { label: 'Review your history', icon: HistoryIcon, action: () => onSelectTool('history') },
              ].map(…)}
```

Add `SpellCheck` and `Newspaper` to the `lucide-react` import; drop `Bot` and `Scale` if now unused.

- [ ] **Step 2: Fix the hero's secondary button**

Replace the "Open playground" button's `onClick={() => onSelectTool('sinllama')}` with `onClick={() => onSelectTool('headlines')}` and its label with `Generate headlines`. Update its icon from `Bot` to `Newspaper`.

- [ ] **Step 3: Remove the "Try a sample" card**

Delete the entire third `<Card>` in the right-hand column (the one headed `Try a sample`) and the now-unused `TOOL_LIST` destructuring of `sampleLabel`/`sample`. Keep `TOOL_LIST` — the writing-tools grid still uses it.

- [ ] **Step 4: Anonymous metric tiles**

Import `useAuth`:

```jsx
import { useAuth } from '../auth/useAuth';
```

and inside the component:

```jsx
  const { user } = useAuth();
```

Replace the metrics `<section>` with a conditional — signed-in users keep the four stat tiles; signed-out visitors, whose `/history` call always 401s and whose tiles can therefore only ever read 0, get an introduction instead:

```jsx
      {user ? (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5" aria-label="Usage metrics">
          <StatCard label="Total runs" value={stats.total} hint="Across all tools" />
          <StatCard label="Today" value={stats.today} hint="Runs since midnight" />
          <StatCard label="This week" value={stats.week} hint="Last 7 days" />
          <StatCard
            label="Most used"
            small={stats.topTool !== '—'}
            value={stats.topTool}
            hint={stats.topTool === '—' ? 'No runs yet' : 'Your go-to tool'}
          />
        </section>
      ) : (
        <Card className="px-5 py-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-[13px] text-ink-700 font-medium">
            All four writing tools are free to use without an account.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="text-[13px] font-semibold text-brand-700 hover:underline cursor-pointer"
          >
            Sign in to save your work →
          </button>
        </Card>
      )}
```

Add `import { useNavigate } from 'react-router-dom';` and `const navigate = useNavigate();`.

- [ ] **Step 5: Verify build and lint**

Run: `npm run build` → clean.
Run: `npm run lint` → ≤ 12 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Dashboard.jsx
git commit -m "fix(web): repair dead dashboard actions, drop samples, anonymous intro"
```

---

### Task 8: Signed-out experience

**Files:**
- Modify: `src/components/Sidebar.jsx`
- Modify: `src/App.jsx` (post-result sign-in cue in the results pane)

- [ ] **Step 1: Give the signed-out sidebar a real sign-in button**

The footer currently renders "Guest / Not signed in" as dead text behind a menu that holds a single item. When there is no `user`, render a direct button instead. Replace the user `<button>` and its dropdown with:

```jsx
          {user ? (
            <>
              {/* existing profile button + profileOpen menu, unchanged */}
            </>
          ) : (
            <button
              id="sidebar-signin"
              onClick={() => navigate('/login')}
              className={`w-full flex items-center gap-2.5 rounded-xl cursor-pointer
                ${collapsed ? 'justify-center px-0 py-2.5' : 'px-2.5 py-2.5'}
                bg-white/[0.06] hover:bg-white/[0.1] transition-colors duration-150`}
              title={collapsed ? 'Sign in' : undefined}
            >
              <LogIn size={16} className="text-white/70 shrink-0" />
              {!collapsed && <span className="text-[12.5px] font-semibold text-white">Sign in</span>}
            </button>
          )}
```

The `profileOpen` state and its menu now only ever render for a signed-in user; remove the `user ? […] : [{ signin }]` ternary inside the menu array so it lists only the four signed-in entries.

- [ ] **Step 2: Add the post-result sign-in cue**

In `App.jsx`'s `ToolRunner`, add `import { useAuth } from './auth/useAuth';` and `const { user } = useAuth();`, then render inside `ResultsPane`, after the output element:

```jsx
            {!user && output && !loading && (
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 rounded-xl bg-ink-50 border border-ink-200/70">
                <span className="text-[12.5px] text-ink-600">
                  Sign in to save this to your history.
                </span>
                <button
                  onClick={() => navigate('/login')}
                  className="text-[12.5px] font-semibold text-brand-700 hover:underline cursor-pointer"
                >
                  Sign in
                </button>
              </div>
            )}
```

`ToolRunner` needs `const navigate = useNavigate();` (it already imports `useLocation` from react-router-dom; add `useNavigate` to that import).

- [ ] **Step 3: Verify build and lint**

Run: `npm run build` → clean.
Run: `npm run lint` → ≤ 12 errors.

- [ ] **Step 4: Manual check**

Signed out: sidebar footer shows a "Sign in" button that routes to `/login`. Run a grammar check — the cue appears below the result. Sign in — the cue is gone and the footer shows the account.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.jsx src/App.jsx
git commit -m "feat(web): first-class signed-out experience"
```

---

### Task 9: Settings

**Files:**
- Modify: `src/components/SettingsPage.jsx`

- [ ] **Step 1: Remove the API configuration section**

Delete the entire `<SettingsSection icon={Globe} title="API configuration" …>` block, `apiBaseUrl` from `DEFAULT_SETTINGS`, the `DEFAULT_API_BASE` import, and `Globe` from the `lucide-react` import.

`getApiBase()` in `services/api.js` still reads `sinai_settings.apiBaseUrl` if present, so a developer can set it by hand in devtools; it simply has no UI. Do not change `api.js`.

- [ ] **Step 2: Swap selects for `Dropdown` and fix the tone list**

Replace the three `<select>` elements with `Dropdown` in `full` variant, sourcing options from `toolOptions` so the tone list carries all five trained styles (it currently offers only three — sports and feature are missing):

```jsx
import Dropdown from './ui/Dropdown';
import { TONES, LENGTHS, HEADLINE_COUNTS } from '../lib/toolOptions';
```

```jsx
            <div>
              <label className={LABEL_CLASS}>Default tone — Style Rewriter</label>
              <Dropdown
                id="default-tone" label="Tone" variant="full" options={TONES}
                value={settings.defaultTone}
                onChange={(v) => update('defaultTone', v)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LABEL_CLASS}>Default summary length</label>
                <Dropdown
                  id="default-length" label="Length" variant="full" options={LENGTHS}
                  value={settings.defaultLength}
                  onChange={(v) => update('defaultLength', v)}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Default headline count</label>
                <Dropdown
                  id="headline-count" label="Count" variant="full" options={HEADLINE_COUNTS}
                  value={settings.headlineCount}
                  onChange={(v) => update('headlineCount', v)}
                />
              </div>
            </div>
```

`SELECT_CLASS` becomes unused — delete it. Keep `INPUT_CLASS` only if still referenced; if not, delete it too.

The existing `touched`-set save semantics are correct (they avoid converting displayed fallbacks into explicit overrides) and must not be changed.

- [ ] **Step 3: Verify build and lint**

Run: `npm run build` → clean.
Run: `npm run lint` → ≤ 12 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/SettingsPage.jsx
git commit -m "feat(web): production Settings — drop API override, all five tones"
```

---

### Task 10: Profile

**Files:**
- Modify: `src/components/ProfilePage.jsx`

- [ ] **Step 1: Rebuild around real account data**

Delete: `getProfile`, `saveProfile`, `DEFAULT_PROFILE`, the `profile`/`saved` state, `update`, `handleSave`, the entire "Personal information" `<Card>`, the Save/Cancel action row, and the avatar's camera `<button>`.

Keep: the Category card exactly as it is (it writes to Supabase under RLS and is the one field that reaches the account).

The identity card becomes read-only, derived from the session:

```jsx
  const { user, profile: accountProfile } = useAuth();
  const email = user?.email ?? '';
  const role = accountProfile?.role === 'admin' ? 'Administrator' : 'Journalist';
  const initials = (email.split('@')[0] || 'S').slice(0, 2).toUpperCase();
```

```jsx
        <Card className="flex items-center gap-5 p-5 sm:p-6">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800
            flex items-center justify-center text-white text-[20px] font-bold shadow-sm shadow-brand-600/25 shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-bold text-ink-900 truncate">{email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Shield size={12} className="text-brand-600 shrink-0" />
              <p className="text-[12.5px] text-ink-600">{role}</p>
            </div>
            <p className="text-[11.5px] text-ink-400 mt-1.5">
              Your email and role are managed by your account and cannot be edited here.
            </p>
          </div>
        </Card>
```

Update the `PageHeader` description from "Stored locally in this browser." to "Your account and how you use SinAi."

Trim the `lucide-react` import to `User, ArrowLeft, Shield, CheckCircle2, Tags`.

The `sinai_profile` localStorage key is now orphaned; nothing else in the codebase reads it, so no migration or cleanup is required.

- [ ] **Step 2: Verify build and lint**

Run: `npm run build` → clean.
Run: `npm run lint` → ≤ 12 errors.

- [ ] **Step 3: Manual check**

Signed in, `/profile`: the real account email appears, no editable identity fields, no Save button, and the Category dropdown still saves (a "Saved" confirmation appears).

- [ ] **Step 4: Commit**

```bash
git add src/components/ProfilePage.jsx
git commit -m "feat(web): Profile shows real account data only"
```

---

### Task 11: Plans

**Files:**
- Modify: `src/components/Plans.jsx`

- [ ] **Step 1: Remove prices, disable the buttons**

Delete the `price` and `period` keys from all three `PLANS` entries and the `<div className="mb-5 flex items-baseline gap-1">` block that renders them.

Replace the plan button with:

```jsx
              <button
                className={`w-full py-2.5 px-5 rounded-xl font-semibold text-[13.5px] mb-6
                  ${isCurrentPlan
                    ? 'bg-ink-100 text-ink-500'
                    : 'bg-ink-50 text-ink-400 border border-ink-200'} cursor-not-allowed`}
                disabled
              >
                {isCurrentPlan ? 'Current plan' : 'Coming soon'}
              </button>
```

and delete the now-unused `buttonClass` keys from `PLANS`.

- [ ] **Step 2: Say so in the header**

Under the existing subtitle paragraph, add:

```jsx
        <p className="text-[12.5px] text-ink-400 mt-3">
          Paid plans are not available yet — every tool is currently free to use.
        </p>
```

- [ ] **Step 3: Verify build and lint**

Run: `npm run build` → clean.
Run: `npm run lint` → ≤ 12 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/Plans.jsx
git commit -m "feat(web): Plans as a roadmap, no prices or dead upgrade buttons"
```

---

## Final verification

- [ ] `npm run build` — clean.
- [ ] `npm run lint` — at or below 12 errors, 1 warning.
- [ ] `git status` — clean tree; `src/components/InputBox.jsx` and `src/components/RightPanel.jsx` gone.
- [ ] Manual matrix from spec §10: four tools × signed-in/signed-out × ≥80rem/<80rem; toolbar dropdowns affect requests; Apply replaces editor content; panes scroll independently at the wide breakpoint; keyboard-only pass over one `Dropdown`.
