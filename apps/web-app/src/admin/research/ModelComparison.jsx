/**
 * Admin-only research instrument, moved here from the user product.
 *
 * Deliberately still styled with the SinAi ink/brand tokens rather than
 * the admin palette. Restyling three large components is cosmetic work
 * with real regression risk, and it should not ride along with a move —
 * these tools are valued for what they do, not how they look. Tracked as
 * follow-up in the Phase 4 plan.
 */

import { useState, useEffect } from 'react';
import {
  Play, RefreshCw, Scale, CheckCircle2, AlertTriangle,
  Info, Sparkles, HelpCircle, CheckSquare, Square, Zap, Trophy,
} from 'lucide-react';
import { getComparisonAdapters, runComparison } from '../../services/api';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import ActionButton from '../../components/ui/ActionButton';
import CopyButton from '../../components/ui/CopyButton';
import { Card } from '../../components/ui/Card';

const PRESET_CASES = {
  grammar: [
    {
      label: 'Spelling & Grammar Correction (Stage 2)',
      input: 'කොළඹ කොටස් වෙළෙඳපොළ මිල දර්ශකවල පසුබැස්මක් අද දිනයේ දී වාර්තා වාර්ථා විය.',
      reference: 'කොළඹ කොටස් වෙළෙඳපොළ මිල දර්ශකවල පසුබැස්මක් අද දිනයේ දී වාර්තා විය.'
    },
    {
      label: 'Subject-Verb Agreement (Plural)',
      input: 'ළමයි පාසලට යනවා.',
      reference: 'ළමයි පාසලට යති.'
    }
  ],
  headline: [
    {
      label: 'Financial Policy News',
      input: 'ශ්‍රී ලංකා මහ බැංකුව විසින් අද දින සිය නවතම මූල්‍ය ප්‍රතිපත්ති වාර්තාව නිකුත් කර තිබේ. එහි දැක්වෙන්නේ ඉදිරි මාස කිහිපය තුළ උද්ධමන වේගය තවදුරටත් පහත වැටෙනු ඇති බවයි.',
      reference: 'මහ බැංකුව නව මූල්‍ය ප්‍රතිපත්තිය නිකුත් කරයි; උද්ධමනය තවදුරටත් පහළට'
    }
  ],
  style: [
    {
      label: 'Sports Rewrite (Informal to Sports Journalism)',
      input: 'ක්‍රීඩකයන් තරගය ජයග්‍රහණය කළා. හැමෝම සතුටු වුණා.',
      reference: 'ක්‍රීඩකයින් විශිෂ්ට ජයග්‍රහණයක් ලබයි; ප්‍රේක්ෂකාගාරය ප්‍රීති ඝෝෂාවෙන් ඇළලී යයි'
    }
  ],
  summarizer: [
    {
      label: 'Cricket Match Announcement',
      input: 'ශ්‍රී ලංකා ක්‍රිකට් කණ්ඩායම සහ ඉන්දීය ක්‍රිකට් කණ්ඩායම අතර පැවැත්වෙන තරග තුනකින් සමන්විත එක්දින ක්‍රිකට් තරගාවලියේ පළමු තරගය අද කොළඹ ආර්. ප්‍රේමදාස ක්‍රීඩාංගණයේ දී පැවැත්වීමට නියමිතව තිබේ. මෙම තරගාවලිය සඳහා දෙරටේම ප්‍රධාන ක්‍රීඩකයින් රැසක් එක්ව සිටින අතර ප්‍රේක්ෂක උනන්දුව ද ඉහළ මට්ටමක පවතී.',
      reference: 'ශ්‍රී ලංකා-ඉන්දියා පළමු එක්දින ක්‍රිකට් තරගය අද කොළඹ දී පැවැත්වේ.'
    }
  ]
};

const METRIC_GUIDE = {
  rougeL: { name: 'ROUGE-L', poor: 0.80, good: 0.93 },
  charF1: { name: 'Char-F1', poor: 0.85, good: 0.95 },
  gleu: { name: 'GLEU', poor: 0.50, good: 0.80 },
  tokenF1: { name: 'Token-F1', poor: 0.80, good: 0.93 },
  overcorrection: { name: 'Over-correction', poor: 0.30, good: 0.10 } // lower is better
};

const TASKS = [
  { id: 'grammar', label: 'Grammar' },
  { id: 'headline', label: 'Headline' },
  { id: 'style', label: 'Style' },
  { id: 'summarizer', label: 'Summarizer' },
];

const FIELD_LABEL = 'text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em] block mb-2';
const TEXTAREA_CLASS = `w-full border border-ink-200 rounded-xl px-3.5 py-2.5 text-[14px] text-ink-800
  placeholder:text-ink-400 bg-white transition-all duration-150
  focus:outline-none focus:border-brand-400 focus:shadow-[0_0_0_3px_rgba(205,25,26,0.07)]`;

export default function ModelComparison() {
  const [adaptersGroup, setAdaptersGroup] = useState({});
  const [loadedInGpu, setLoadedInGpu] = useState([]);
  const [serverMode, setServerMode] = useState('checking'); // mock, gpu, checking

  const [task, setTask] = useState('grammar');
  const [styleMode, setStyleMode] = useState('formal');
  const [inputText, setInputText] = useState('');
  const [referenceText, setReferenceText] = useState('');
  const [selectedAdapters, setSelectedAdapters] = useState([]);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [highlightMatches, setHighlightMatches] = useState(true);

  // Helper to heal broken BPE subword token splits (e.g. 'ප්‍ර දේශයේ' -> 'ප්‍රදේශයේ')
  const healSinhalaText = (text) => {
    if (!text) return text;
    let healed = text.replace(/\b([\u0D80-\u0DFF][්‍්]?[ර්‍ර])\s+([\u0D80-\u0DFF]+)/gu, '$1$2');
    const splits = [
      [/ප්‍ර\s+දේශ/gu, 'ප්‍රදේශ'],
      [/පා\s+රිභෝගික/gu, 'පාරිභෝගික'],
      [/වී\s+යාජ/gu, 'ව්‍යාජ'],
      [/මහේස්ත්‍\s+රාත්/gu, 'මහේස්ත්‍රාත්'],
      [/අත්\s+අඩංගුවට/gu, 'අත්අඩංගුවට'],
    ];
    splits.forEach(([pattern, repl]) => {
      healed = healed.replace(pattern, repl);
    });
    return healed.replace(/\s+/gu, ' ').trim();
  };

  // Helper to calculate verbatim overlap percentage
  const getVerbatimStats = (outputText, input) => {
    const cleanedOutput = healSinhalaText(outputText);
    if (!cleanedOutput || !input) return { matchPct: 0, total: 0, matched: 0 };
    const inputWordSet = new Set(
      input.toLowerCase().split(/[^\w\u0D80-\u0DFF]+/u).filter(w => w.trim().length > 0)
    );
    const outputWords = cleanedOutput.toLowerCase().split(/[^\w\u0D80-\u0DFF]+/u).filter(w => w.trim().length > 0);
    if (outputWords.length === 0) return { matchPct: 0, total: 0, matched: 0 };
    let matchedCount = 0;
    outputWords.forEach(w => {
      if (inputWordSet.has(w)) matchedCount++;
    });
    return {
      matchPct: Math.round((matchedCount / outputWords.length) * 100),
      total: outputWords.length,
      matched: matchedCount
    };
  };

  // Helper to render output text with light yellow highlights for verbatim matches
  const renderHighlightedOutput = (outputText, input, shouldHighlight = true) => {
    const cleanedOutput = healSinhalaText(outputText);
    if (!cleanedOutput) return null;
    if (!shouldHighlight || !input) {
      return <pre className="text-[13.5px] text-ink-800 font-sans font-normal leading-relaxed whitespace-pre-wrap bg-ink-50/60 px-3.5 py-3 rounded-xl border border-ink-100 select-all min-h-[70px] m-0">{cleanedOutput}</pre>;
    }
    const inputWordSet = new Set(
      input.toLowerCase().split(/[^\w\u0D80-\u0DFF]+/u).filter(w => w.trim().length > 0)
    );
    const tokens = cleanedOutput.split(/([^\w\u0D80-\u0DFF]+)/u);
    return (
      <div className="text-[13.5px] text-ink-800 font-sans font-normal leading-[1.85] bg-ink-50/60 px-3.5 py-3 rounded-xl border border-ink-100 min-h-[70px] select-all">
        {tokens.map((tok, i) => {
          const clean = tok.toLowerCase().trim();
          const isMatch = clean.length > 0 && inputWordSet.has(clean);
          if (isMatch) {
            return (
              <mark
                key={i}
                className="bg-yellow-200/85 text-yellow-950 font-medium px-1 py-0.5 rounded-[3px] border border-yellow-300/70"
                title="Verbatim match from input text (Extracted)"
              >
                {tok}
              </mark>
            );
          }
          return <span key={i}>{tok}</span>;
        })}
      </div>
    );
  };

  // Fetch list of adapters from server on mount
  const fetchAdapters = async () => {
    setError(null);
    setServerMode('checking');
    try {
      const data = await getComparisonAdapters();
      setAdaptersGroup(data.adapters || {});
      setLoadedInGpu(data.loaded_in_gpu || []);
      setServerMode(data.mode || 'gpu');

      // Auto-select domain-specific adapters for initial task
      autoSelectForTask(task, data.adapters || {});
    } catch (err) {
      setError(err.message || 'Failed to retrieve adapters from GPU server.');
      setServerMode('error');
    }
  };

  useEffect(() => {
    fetchAdapters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update selection when task changes
  useEffect(() => {
    autoSelectForTask(task, adaptersGroup);
  }, [task, adaptersGroup]);

  const autoSelectForTask = (currentTask, groups) => {
    const list = groups[currentTask] || [];
    if (currentTask === 'summarizer') {
      const extList = groups['extractive'] || ['tfidf', 'textrank', 'rake', 'yake', 'keybert'];
      const mt5List = groups['mt5'] || ['mt5-base'];
      setSelectedAdapters([...list, ...mt5List, ...extList, 'base']);
    } else {
      setSelectedAdapters([...list, 'base']);
    }
  };

  const handleSelectAdapter = (name) => {
    setSelectedAdapters(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  // Selection actions
  const selectAll = () => {
    const all = Object.values(adaptersGroup).flat();
    setSelectedAdapters([...all, 'base']);
  };

  const selectDomainSpecific = () => {
    const list = adaptersGroup[task] || [];
    setSelectedAdapters([...list, 'base']);
  };

  const selectAllButDomainSpecific = () => {
    const otherTasks = Object.keys(adaptersGroup).filter(t => t !== task);
    const list = otherTasks.map(t => adaptersGroup[t]).flat();
    setSelectedAdapters([...list, 'base']);
  };

  const clearSelection = () => {
    setSelectedAdapters([]);
  };

  const loadPreset = (preset) => {
    setInputText(preset.input);
    setReferenceText(preset.reference);
  };

  const handleCompare = async () => {
    if (!inputText.trim()) {
      setError('Please provide an input text to evaluate.');
      return;
    }
    if (selectedAdapters.length === 0) {
      setError('Please select at least one model/adapter to test.');
      return;
    }

    setLoading(true);
    setError(null);
    setResults([]);

    // Simulate loading progression since deep models can take 1-5 seconds on start
    setLoadingProgress('Initializing model gateway...');
    const progressSteps = [
      'Configuring LoRA weights...',
      'Activating dynamic Peft injection...',
      'Running tokenizers...',
      'Evaluating metrics...'
    ];

    let step = 0;
    const progressInterval = setInterval(() => {
      if (step < progressSteps.length) {
        setLoadingProgress(progressSteps[step]);
        step++;
      }
    }, 1500);

    try {
      const payload = {
        input_text: inputText,
        adapters: selectedAdapters,
        task: task,
        style: task === 'style' ? styleMode : null,
        reference_text: referenceText || null
      };

      const data = await runComparison(payload);
      clearInterval(progressInterval);
      setResults(data);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message || 'Error occurred during comparison. Ensure the GPU server is online.');
    } finally {
      setLoading(false);
      setLoadingProgress('');
    }
  };

  // Helper to color-code metric scores
  const getMetricBadgeClass = (metricKey, val) => {
    if (val === undefined || val === null) return 'bg-ink-100 text-ink-500';
    const thresholds = METRIC_GUIDE[metricKey];
    if (!thresholds) return 'bg-blue-50 text-blue-700';

    if (metricKey === 'overcorrection') {
      // For overcorrection, lower is better
      if (val >= thresholds.poor) return 'bg-brand-50 text-brand-700 border border-brand-200/70';
      if (val <= thresholds.good) return 'bg-emerald-50 text-emerald-700 border border-emerald-200/70';
      return 'bg-amber-50 text-amber-700 border border-amber-200/70';
    } else {
      // Normal metrics, higher is better
      if (val < thresholds.poor) return 'bg-brand-50 text-brand-700 border border-brand-200/70';
      if (val >= thresholds.good) return 'bg-emerald-50 text-emerald-700 border border-emerald-200/70';
      return 'bg-amber-50 text-amber-700 border border-amber-200/70';
    }
  };

  // Helper to render metric values
  const formatMetricValue = (key, val) => {
    if (val === undefined || val === null) return '-';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return (val * 100).toFixed(1) + '%';
  };

  const AdapterRow = ({ name, category, displayName }) => {
    const isSelected = selectedAdapters.includes(name);
    const isLoaded = loadedInGpu.includes(name);
    return (
      <button
        type="button"
        onClick={() => handleSelectAdapter(name)}
        aria-pressed={isSelected}
        className={`w-full flex items-center justify-between px-2.5 py-2.5 rounded-xl border cursor-pointer transition-all duration-150 text-left
          ${isSelected
            ? 'border-brand-300 bg-brand-50/70'
            : 'border-ink-100 hover:bg-ink-50 hover:border-ink-200'}`}
      >
        <span className="flex items-center gap-2 min-w-0">
          {isSelected
            ? <CheckSquare size={15} className="text-brand-600 shrink-0" />
            : <Square size={15} className="text-ink-300 shrink-0" />}
          <span className={`text-[12px] truncate ${isSelected ? 'font-semibold text-ink-900' : 'font-medium text-ink-600'}`}>
            {displayName ?? name}
          </span>
        </span>
        <span className="flex items-center gap-1 shrink-0 ml-2">
          {isLoaded && (
            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded" title="Loaded in GPU cache">
              GPU
            </span>
          )}
          {category && (
            <span className="text-[9px] bg-ink-100 text-ink-500 font-bold px-1.5 py-0.5 rounded uppercase">
              {category.substring(0, 4)}
            </span>
          )}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-5 pb-8">
      <PageHeader
        icon={Scale}
        title="Model Comparison"
        description="Benchmark the SinLLaMA base model against fine-tuned LoRA adapters and track improvement per task."
        badge={
          serverMode === 'gpu'      ? <StatusBadge status="online"   label="GPU backend online" /> :
          serverMode === 'mock'     ? <StatusBadge status="warning"  label="Mock mode" /> :
          serverMode === 'error'    ? <StatusBadge status="offline"  label="Backend unreachable" /> :
                                      <StatusBadge status="checking" label="Checking backend…" pulse />
        }
        actions={
          <ActionButton size="sm" variant="secondary" icon={RefreshCw} onClick={fetchAdapters} title="Refresh adapter list">
            Refresh
          </ActionButton>
        }
      />

      {/* ── Configuration ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* Inputs & controls */}
        <Card className="lg:col-span-3 p-5 sm:p-6 flex flex-col gap-5">
          <div>
            <label className={FIELD_LABEL}>Task domain</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {TASKS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTask(t.id)}
                  aria-pressed={task === t.id}
                  className={`py-2 px-3 text-[13px] font-semibold rounded-lg border transition-all duration-150 cursor-pointer text-center
                    ${task === t.id
                      ? 'bg-brand-600 text-white border-brand-600 shadow-sm shadow-brand-600/20'
                      : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300 hover:bg-ink-50'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {task === 'style' && (
            <div>
              <label htmlFor="style-mode" className={FIELD_LABEL}>Rewrite style tone</label>
              <select
                id="style-mode"
                value={styleMode}
                onChange={(e) => setStyleMode(e.target.value)}
                className="w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[14px] text-ink-800
                  cursor-pointer transition-all duration-150
                  focus:outline-none focus:border-brand-400 focus:shadow-[0_0_0_3px_rgba(205,25,26,0.07)]"
              >
                <option value="formal">Formal News (නිල පුවත්)</option>
                <option value="sports">Sports Journalism (ක්‍රීඩා පුවත්)</option>
                <option value="youth">Youth / Casual (තරුණ ශෛලිය)</option>
                <option value="editorial">Analytical Editorial (සංස්කාරකීය)</option>
                <option value="feature">Feature Story (විශේෂාංග ලිපි)</option>
              </select>
            </div>
          )}

          {PRESET_CASES[task] && PRESET_CASES[task].length > 0 && (
            <div>
              <label className={FIELD_LABEL}>Quick presets</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_CASES[task].map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => loadPreset(preset)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium bg-white border border-ink-200
                      text-ink-600 rounded-full px-3 py-1.5 cursor-pointer transition-all duration-150
                      hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50 active:scale-[0.98]"
                  >
                    <Sparkles size={11} />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="comparison-input" className={FIELD_LABEL}>Input sentence / text</label>
            <textarea
              id="comparison-input"
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter Sinhala text to run inference…"
              className={TEXTAREA_CLASS}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="comparison-reference" className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em] flex items-center gap-1.5">
                Expected / reference output
                <span className="text-[9.5px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200/70 normal-case tracking-normal">
                  Optional
                </span>
              </label>
              <div className="group relative">
                <HelpCircle size={13} className="text-ink-400 cursor-help" />
                <span className="pointer-events-none absolute right-0 bottom-full mb-2 w-64 bg-ink-900 text-white text-[11px] p-2.5 rounded-lg
                  opacity-0 group-hover:opacity-100 transition-opacity leading-relaxed z-30 shadow-pop">
                  Supplying a ground truth reference output allows the backend to calculate quantitative BLEU/GLEU, F1, and over-correction metrics.
                </span>
              </div>
            </div>
            <textarea
              id="comparison-reference"
              rows={2}
              value={referenceText}
              onChange={(e) => setReferenceText(e.target.value)}
              placeholder="Provide expected ground truth for automatic score evaluations…"
              className={TEXTAREA_CLASS}
            />
          </div>
        </Card>

        {/* Adapter selection */}
        <Card className="lg:col-span-2 p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <label className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em]">Models under test</label>
            <span className="text-[11px] font-bold text-ink-600 bg-ink-100 px-2 py-0.5 rounded-full tabular-nums">
              {selectedAdapters.length} selected
            </span>
          </div>

          {/* Quick multi-select */}
          <div className="flex flex-wrap gap-1.5 pb-3 border-b border-ink-100">
            {[
              { label: 'Current task', action: selectDomainSpecific, accent: true },
              { label: 'All except current', action: selectAllButDomainSpecific },
              { label: 'Select all', action: selectAll },
              { label: 'Clear', action: clearSelection },
            ].map(({ label, action, accent }) => (
              <button
                key={label}
                onClick={action}
                className={`text-[10.5px] font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors duration-150
                  ${accent
                    ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                    : 'bg-ink-100 text-ink-600 hover:bg-ink-200'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Adapter list */}
          <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto overflow-x-hidden pr-1.5">
            <AdapterRow name="base" displayName="base (SinLLaMA Base)" />
            {Object.keys(adaptersGroup).map((category) => {
              const list = adaptersGroup[category] || [];
              if (list.length === 0) return null;
              return (
                <div key={category} className="mt-1 flex flex-col gap-1.5">
                  <span className="text-[9.5px] font-bold text-ink-400 uppercase pl-1 tracking-[0.14em] mt-1">
                    {category} domain
                  </span>
                  {list.map((name) => (
                    <AdapterRow key={name} name={name} category={category} />
                  ))}
                </div>
              );
            })}
          </div>

          <ActionButton
            variant="primary"
            size="lg"
            icon={Play}
            loading={loading}
            onClick={handleCompare}
            disabled={loading || !inputText.trim() || selectedAdapters.length === 0}
            className="w-full mt-auto"
          >
            {loading ? (loadingProgress || 'Evaluating…') : 'Run comparison'}
          </ActionButton>
        </Card>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="bg-brand-50 border border-brand-200/70 rounded-xl px-4 py-3.5 flex items-start gap-2.5 text-brand-800 text-[13px]" role="alert">
          <AlertTriangle className="shrink-0 mt-0.5 text-brand-600" size={16} />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* ── Results ── */}
      {results.length > 0 && (
        <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="border-t border-ink-200/70 pt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-emerald-500" size={18} />
              <h2 className="text-[16px] font-bold text-ink-900 tracking-tight">Evaluation results</h2>
              <span className="text-[11.5px] text-ink-400 tabular-nums ml-1">{results.length} model{results.length !== 1 ? 's' : ''}</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setHighlightMatches(prev => !prev)}
                className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3 py-1.5 rounded-full border transition-all duration-150 cursor-pointer
                  ${highlightMatches
                    ? 'bg-yellow-100/90 text-yellow-900 border-yellow-300 shadow-sm'
                    : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-50'}`}
                title="Highlight words in output that appear verbatim in the input text"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-500 shrink-0" />
                Highlight verbatim matches
              </button>
            </div>
          </div>

          {highlightMatches && (
            <div className="bg-yellow-50/70 border border-yellow-200/80 rounded-xl px-4 py-2.5 flex items-center justify-between text-[12px] text-yellow-900">
              <span className="flex items-center gap-2">
                <span className="bg-yellow-200/90 text-yellow-950 font-bold px-1.5 py-0.5 rounded border border-yellow-300 text-[11px]">Yellow highlight</span>
                Exact word/phrase copied verbatim from input (Extracted)
              </span>
              <span className="text-[11.5px] text-yellow-800 font-medium hidden sm:inline">
                Plain text = Model generated / synthesized rephrasing (Abstractive)
              </span>
            </div>
          )}

          {/* Side-by-side response panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {results.map((res) => {
              const hasMetrics = res.metrics && Object.keys(res.metrics).length > 0;
              const isBestLatency = results.every(other => other.latency_ms >= res.latency_ms);
              const isBestRougeL = hasMetrics && results.every(other =>
                !other.metrics || !other.metrics.rougeL || other.metrics.rougeL <= res.metrics.rougeL
              );
              const vStats = getVerbatimStats(res.output_text, inputText);

              return (
                <Card key={res.adapter_name} className="flex flex-col overflow-hidden">
                  {/* Header */}
                  <div className="bg-ink-50/70 border-b border-ink-100 px-4 py-3 flex items-center justify-between gap-2">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9.5px] font-bold text-ink-400 uppercase tracking-[0.14em]">{res.category} model</span>
                      <span className="text-[13px] font-bold text-ink-900 truncate" title={res.adapter_name}>
                        {res.adapter_name === 'base'
                          ? 'SinLLaMA Base'
                          : ['mt5-base', 'mt5'].includes(res.adapter_name)
                          ? 'mT5 Base (Teacher Model)'
                          : ['tfidf', 'textrank', 'rake', 'yake', 'keybert'].includes(res.adapter_name)
                          ? `${res.adapter_name.toUpperCase()} (Extractive)`
                          : res.adapter_name}
                      </span>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {isBestLatency && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-bold px-2 py-0.5 rounded-full" title="Fastest inference speed">
                          <Zap size={10} /> Fastest
                        </span>
                      )}
                      {isBestRougeL && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200/70 font-bold px-2 py-0.5 rounded-full" title="Highest semantic match">
                          <Trophy size={10} /> Best match
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Output */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9.5px] font-bold text-ink-400 uppercase tracking-[0.14em]">Output</span>
                          {vStats.total > 0 && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border tabular-nums ${
                                vStats.matchPct >= 85
                                  ? 'bg-yellow-100 text-yellow-900 border-yellow-300'
                                  : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              }`}
                              title={`${vStats.matched} of ${vStats.total} words match input text`}
                            >
                              {vStats.matchPct >= 85
                                ? `Extracted (${vStats.matchPct}% verbatim)`
                                : `Abstractive (${vStats.matchPct}% verbatim)`}
                            </span>
                          )}
                        </div>
                        <CopyButton text={res.output_text} label="" className="!px-1.5" />
                      </div>
                      {renderHighlightedOutput(res.output_text, inputText, highlightMatches)}
                    </div>

                    {/* Runtime metadata */}
                    <div className="border-t border-ink-100 pt-3 flex flex-wrap justify-between items-center gap-2 text-[11.5px] text-ink-500 tabular-nums">
                      <span>Latency <span className="font-bold text-ink-700">{res.latency_ms} ms</span></span>
                      <span>Throughput <span className="font-bold text-ink-700">{res.throughput_tokens_per_sec} tok/s</span></span>
                      <span>Tokens <span className="font-bold text-ink-700">{res.output_tokens} out</span></span>
                    </div>
                  </div>


                  {/* Reference scores */}
                  {hasMetrics && (
                    <div className="bg-ink-50/70 border-t border-ink-100 p-3.5 grid grid-cols-2 gap-2 text-[11.5px]">
                      {[
                        ['ROUGE-L', 'rougeL', res.metrics.rougeL, `${(res.metrics.rougeL * 100).toFixed(0)}%`],
                        ['GLEU', 'gleu', res.metrics.gleu, `${(res.metrics.gleu * 100).toFixed(0)}%`],
                        ['Char-F1', 'charF1', res.metrics.charF1, `${(res.metrics.charF1 * 100).toFixed(0)}%`],
                        ['Over-corr', 'overcorrection', res.metrics.over_correction ? 1 : 0, res.metrics.over_correction ? 'Warning' : 'None'],
                      ].map(([label, key, val, display]) => (
                        <div key={label} className="flex justify-between items-center bg-white px-2.5 py-1.5 rounded-lg border border-ink-100">
                          <span className="text-ink-500">{label}</span>
                          <span className={`px-2 py-0.5 rounded font-bold tabular-nums ${getMetricBadgeClass(key, val)}`}>
                            {display}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Metrics matrix */}
          {results[0] && results[0].metrics && Object.keys(results[0].metrics).length > 0 && (
            <Card className="overflow-hidden">
              <div className="px-4 py-3.5 border-b border-ink-100 bg-ink-50/70 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-ink-900">Quantitative metrics matrix</span>
                <span className="text-[11px] text-ink-500">Green = target · Amber = acceptable · Red = poor</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11.5px]">
                  <thead>
                    <tr className="bg-ink-50/60 border-b border-ink-100">
                      <th className="p-3 font-bold text-ink-500 uppercase tracking-wider text-[10px]">Model</th>
                      {['Exact match', 'ROUGE-L', 'ROUGE-1', 'ROUGE-2', 'GLEU (BLEU)', 'Char-F1', 'Token-F1', 'Over-correction'].map((h) => (
                        <th key={h} className="p-3 font-bold text-ink-500 uppercase tracking-wider text-center text-[10px] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((res) => {
                      const m = res.metrics || {};
                      return (
                        <tr key={res.adapter_name} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/50 font-medium tabular-nums">
                          <td className="p-3 font-bold text-ink-800 whitespace-nowrap">
                            {res.adapter_name === 'base' ? 'SinLLaMA Base' : res.adapter_name}
                          </td>
                          <td className="p-3 text-center">
                            {m.exact_match !== undefined ? (
                              m.exact_match
                                ? <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-bold px-2 py-0.5 rounded">Yes</span>
                                : <span className="bg-ink-100 text-ink-500 font-bold px-2 py-0.5 rounded">No</span>
                            ) : '-'}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold ${getMetricBadgeClass('rougeL', m.rougeL)}`}>
                              {formatMetricValue('rougeL', m.rougeL)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="bg-ink-50 border border-ink-100 text-ink-600 px-2 py-0.5 rounded-full">
                              {formatMetricValue('rouge1', m.rouge1)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="bg-ink-50 border border-ink-100 text-ink-600 px-2 py-0.5 rounded-full">
                              {formatMetricValue('rouge2', m.rouge2)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold ${getMetricBadgeClass('gleu', m.gleu)}`}>
                              {formatMetricValue('gleu', m.gleu)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold ${getMetricBadgeClass('charF1', m.charF1)}`}>
                              {formatMetricValue('charF1', m.charF1)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold ${getMetricBadgeClass('tokenF1', m.tokenF1)}`}>
                              {formatMetricValue('tokenF1', m.tokenF1)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {m.over_correction !== undefined ? (
                              m.over_correction ? (
                                <span className="inline-flex items-center justify-center gap-1 bg-brand-50 text-brand-700 border border-brand-200/70 font-bold px-2 py-0.5 rounded">
                                  <AlertTriangle size={10} /> Yes
                                </span>
                              ) : (
                                <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-bold px-2.5 py-0.5 rounded">No</span>
                              )
                            ) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Benchmark guide */}
          {results[0] && results[0].metrics && Object.keys(results[0].metrics).length > 0 && (
            <div className="bg-blue-50/60 border border-blue-200/60 rounded-2xl px-4 py-3.5 flex items-start gap-3">
              <Info className="text-blue-500 mt-0.5 shrink-0" size={16} />
              <div className="flex flex-col gap-1 text-[12px] text-blue-900">
                <span className="font-bold">Linguistic benchmark guide for Sinhala LLM</span>
                <p className="leading-relaxed">
                  In a spelling and grammar correction task, a high <b>Char-F1 (&gt;95%)</b> indicates solid character spelling accuracy,
                  while a high <b>ROUGE-L (&gt;93%)</b> confirms correct sentence structure. <b>Over-correction</b> highlights cases where
                  the model incorrectly alters grammatically sound input and should be kept below 10% on test datasets.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
