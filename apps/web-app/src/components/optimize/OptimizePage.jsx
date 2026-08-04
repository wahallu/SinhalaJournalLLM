import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, FileText, Newspaper, PenLine, SpellCheck, Wand2, X } from 'lucide-react';
import Editor from '../editor/Editor';
import ResultsPane from '../editor/ResultsPane';
import Dropdown from '../ui/Dropdown';
import ActionButton from '../ui/ActionButton';
import OptimizeResults from './OptimizeResults';
import { LENGTHS, TONES } from '../../lib/toolOptions';
import { useAuth } from '../../auth/useAuth';
import { useOptimize } from '../../hooks/useOptimize';

const PLACEHOLDER = "fuys iïmQrK ,smsh we;=<;a lrkak'''";

/**
 * One opt-in stage of the pipeline: a toggle, and its parameter dropdown once
 * it is on.
 *
 * A toggle rather than a checkbox row for all four stages: grammar and
 * headlines always run, so this is a one-click action with two extras, not a
 * form the user has to fill in before anything happens.
 */
/* A stage that always runs — shown, not offered. */
function FixedStage({ label, icon: Icon }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-ink-100
        text-[12px] font-semibold text-ink-700 shrink-0"
      title="Always runs"
    >
      <Icon size={13} strokeWidth={2.25} />
      {label}
    </span>
  );
}

function Chevron() {
  return <ChevronRight size={13} className="text-ink-300 shrink-0" aria-hidden="true" />;
}

function StageToggle({ id, label, icon: Icon, note, on, onToggle, control }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        id={`optimize-toggle-${id}`}
        type="button"
        role="switch"
        aria-checked={on}
        onClick={() => onToggle(!on)}
        title={note}
        className={`inline-flex items-center gap-2 pl-2 pr-2.5 py-1.5 rounded-lg border
          text-[12px] font-semibold cursor-pointer transition-colors duration-150
          ${on
            ? 'bg-brand-50 border-brand-200 text-brand-700'
            : 'bg-white border-ink-200 text-ink-500 hover:border-ink-300 hover:text-ink-700'}`}
      >
        <span
          className={`relative w-7 h-4 rounded-full shrink-0 transition-colors duration-150
            ${on ? 'bg-brand-600' : 'bg-ink-300'}`}
          aria-hidden="true"
        >
          <span
            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-150
              ${on ? 'left-3.5' : 'left-0.5'}`}
          />
        </span>
        <Icon size={13} strokeWidth={2.25} className="shrink-0" />
        {label}
      </button>
      {on && control}
    </div>
  );
}

/**
 * Optimize Article — the four writing tools as one ordered run.
 *
 * The editor is the same one the individual tools use; what differs is the
 * right pane, which fills in stage by stage as the NDJSON stream arrives
 * rather than waiting for all four model calls to finish behind one spinner.
 */
export default function OptimizePage({ settings, setSettings }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Seeded from router state — the dashboard's "reopen in tool" actions hand
  // the article over that way. Read at mount rather than in an effect: the
  // route wrapper is keyed on pathname, so arriving here always mounts fresh.
  const [text, setText] = useState(() => location.state?.text ?? '');
  const { stages, result, running, error, run, cancel, reset } = useOptimize();

  // Drop the handed-over text once consumed, so a refresh or a Back does not
  // re-seed the editor over whatever the user has since typed.
  useEffect(() => {
    if (location.state?.text) window.history.replaceState({}, document.title);
  }, [location.state]);

  const restyle = settings.optimizeRestyle ?? false;
  const summarize = settings.optimizeSummarize ?? false;

  const handleRun = useCallback(() => {
    run(text, {
      restyle,
      tone: settings.tone,
      summarize,
      length: settings.length,
      headlineCount: settings.count,
      headlineCategory: settings.category || 'General',
      headlineLength: settings.headlineLength,
    });
  }, [run, text, restyle, summarize, settings]);

  const handleClear = useCallback(() => {
    setText('');
    reset();
  }, [reset]);

  // A headline is not a replacement for the article, so "Use" prepends it
  // rather than overwriting the editor the way Apply does.
  const handleUseHeadline = useCallback((headline) => {
    setText((prev) => `${headline}\n\n${prev}`);
  }, []);

  return (
    <div className="tool-workspace">
      <div className="tw-editor flex flex-col gap-3">
        {/* The pipeline itself, laid out in the order it runs. Grammar and
            headlines are fixed steps rather than toggles so the run stays one
            click; the two optional stages sit at the points where they would
            actually happen — restyle before the read-only stages, because it
            rewrites the text they are generated from. */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2 px-3.5 py-2.5 rounded-xl
          bg-white border border-ink-200/80 shadow-card">
          <span className="text-[10px] font-bold text-ink-500 uppercase tracking-[0.12em] pr-1 shrink-0">
            Pipeline
          </span>
          <FixedStage label="Grammar" icon={SpellCheck} />
          <Chevron />
          <StageToggle
            id="restyle"
            label="Restyle"
            icon={PenLine}
            note="Rewrite the corrected text before headlines and summary are written"
            on={restyle}
            onToggle={(v) => setSettings({ ...settings, optimizeRestyle: v })}
            control={
              <Dropdown
                id="optimize-tone"
                label="Tone"
                options={TONES}
                value={settings.tone}
                onChange={(v) => setSettings({ ...settings, tone: v })}
              />
            }
          />
          <Chevron />
          <FixedStage label="Headlines" icon={Newspaper} />
          <StageToggle
            id="summarize"
            label="Summarize"
            icon={FileText}
            note="Also produce a summary of the final text"
            on={summarize}
            onToggle={(v) => setSettings({ ...settings, optimizeSummarize: v })}
            control={
              <Dropdown
                id="optimize-length"
                label="Length"
                options={LENGTHS}
                value={settings.length}
                onChange={(v) => setSettings({ ...settings, length: v })}
              />
            }
          />
        </div>

        <Editor
          tool="optimize"
          title="Optimize Article"
          icon={Wand2}
          placeholder={PLACEHOLDER}
          actionLabel="Optimize"
          helper="Runs grammar, then style, then headlines and summary"
          value={text}
          onChange={setText}
          onRun={handleRun}
          onClear={handleClear}
          loading={running}
          settings={settings}
          onSettingsChange={setSettings}
        />
      </div>

      <div className="tw-results flex flex-col">
        <ResultsPane
          title="Optimize run"
          right={
            running && (
              <ActionButton size="sm" variant="ghost" icon={X} onClick={cancel}>
                Stop
              </ActionButton>
            )
          }
        >
          <OptimizeResults
            stages={stages}
            result={result}
            running={running}
            error={error}
            articleText={text}
            onApply={setText}
            onUseHeadline={handleUseHeadline}
          />

          {!user && result && !running && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3
              rounded-xl bg-ink-50 border border-ink-200/70">
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
        </ResultsPane>
      </div>
    </div>
  );
}
