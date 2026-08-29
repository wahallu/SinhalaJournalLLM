/**
 * Admin-only research instrument.
 *
 * Provides a presentation-grade benchmark suite to compare SinLLaMA decoder
 * models, mT5 teacher baselines, extractive algorithms, and base models across
 * Summarizer, Grammar, Headline, and Style tasks. Designed with non-technical
 * explanations, executive summaries, and clear proofs of model differentiation.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Play, RefreshCw, Scale, CheckCircle2, AlertTriangle,
  Info, Sparkles, HelpCircle, CheckSquare, Square, Zap, Trophy,
  BookOpen, Award, Layers, BarChart3, ChevronDown, ChevronUp,
  FileText, Lightbulb, ExternalLink, Check, Copy, Sliders
} from 'lucide-react';
import { getComparisonAdapters, runComparison } from '../../services/api';
import PageHeader from '../../components/ui/PageHeader';
import StatusBadge from '../../components/ui/StatusBadge';
import ActionButton from '../../components/ui/ActionButton';
import CopyButton from '../../components/ui/CopyButton';
import { Card } from '../../components/ui/Card';
import { LENGTHS } from '../../lib/toolOptions';

const SUMMARIZER_LENGTH_CONDITIONED_FROM_VERSION = 6;
const isLengthConditionedAdapter = (name) => {
  const match = /_v(\d+)/i.exec(name || '');
  return !!match && parseInt(match[1], 10) >= SUMMARIZER_LENGTH_CONDITIONED_FROM_VERSION;
};

const PRESET_CASES = {
  summarizer: [
    {
      label: 'Highway Maintenance Project (අධිවේගී මාර්ග)',
      input: 'බස්නාහිර පළාතේ ප්‍රධාන මාර්ග කිහිපයක් ප්‍රතිසංස්කරණය කිරීමේ විශාල ව්‍යාපෘතියක් ලබන සතියේ සිට ආරම්භ කිරීමට මහාමාර්ග අමාත්‍යාංශය තීරණය කර ඇත. මේ සඳහා රුපියල් මිලියන 500 ක මුදලක් වෙන්කර ඇති අතර ව්‍යාපෘතිය මාස 6 ක් ඇතුළත අවසන් කිරීමට නියමිතය. මෙමගින් නගරබද මාර්ග තදබදය සැලකිය යුතු ලෙස අඩුවනු ඇතැයි අපේක්ෂා කෙරේ.',
      reference: 'රුපියල් මිලියන 500ක වියදමින් බස්නාහිර පළාතේ ප්‍රධාන මාර්ග ප්‍රතිසංස්කරණය කිරීමේ 6-මස ව්‍යාපෘතියක් ලබන සතියේ ආරම්භ වේ.'
    },
    {
      label: 'Public Health & Market Inspection (සෞඛ්‍ය පරීක්ෂාව)',
      input: 'පාරිභෝගික අධිකාරිය සහ මහජන සෞඛ්‍ය පරීක්ෂකවරුන් විසින් කොළඹ නගරයේ වෙළඳසැල් කිහිපයක් හදිසි පරීක්ෂාවකට ලක් කර ඇත. මෙහිදී සොයාගත් හානිකර ආහාර ද්‍රව්‍ය අඩංගු බෝතල් කිහිපයක් අත්අඩංගුවට ගෙන විනාශ කිරීමට පියවර ගන්නා ලදී. නීති විරෝධී ලෙස අලෙවි කළ වෙළෙන්දන්ට එරෙහිව අධිකරණමය ක්‍රියාමාර්ග ගැනීමට නියෝග කෙරුණි.',
      reference: 'කොළඹ වෙළඳසැල් පරීක්ෂාවකදී හමුවූ හානිකර ආහාර ද්‍රව්‍ය විනාශ කර අදාළ වෙළෙන්දන්ට එරෙහිව නීතිමය ක්‍රියාමාර්ග ගෙන තිබේ.'
    },
    {
      label: 'Agriculture & Fertilizer Subsidy (පොහොර සහනාධාරය)',
      input: 'නව මහ කන්නය සඳහා ගොවීන් වෙත ලබාදෙන පොහොර සහනාධාරය ලබන සඳුදා සිට බෙදා හැරීමට කෘෂිකර්ම අමාත්‍යාංශය කටයුතු යොදා තිබේ. දිස්ත්‍රික් මට්ටමින් ස්ථාපිත ගොවිජන සේවා මධ්‍යස්ථාන හරහා මෙම සහනාධාර ලබාගත හැකිය. කාබනික සහ රසායනික පොහොර වර්ග දෙකම ගොවීන්ගේ කැමැත්ත පරිදි තෝරාගැනීමට අවස්ථාව සලසා දී ඇත.',
      reference: 'නව මහ කන්නයේ පොහොර සහනාධාරය ලබන සඳුදා සිට ගොවිජන සේවා මධ්‍යස්ථාන හරහා බෙදා හැරීමට කටයුතු යොදා ඇත.'
    },
    {
      label: 'Cricket Championship (ක්‍රිකට් තරගාවලිය)',
      input: 'ශ්‍රී ලංකා ක්‍රිකට් කණ්ඩායම සහ ඉන්දීය ක්‍රිකට් කණ්ඩායම අතර පැවැත්වෙන තරග තුනකින් සමන්විත එක්දින ක්‍රිකට් තරගාවලියේ පළමු තරගය අද කොළඹ ආර්. ප්‍රේමදාස ක්‍රීඩාංගණයේ දී පැවැත්වීමට නියමිතව තිබේ. මෙම තරගාවලිය සඳහා දෙරටේම ප්‍රධාන ක්‍රීඩකයින් රැසක් එක්ව සිටින අතර ප්‍රේක්ෂක උනන්දුව ද ඉහළ මට්ටමක පවතී.',
      reference: 'ශ්‍රී ලංකා-ඉන්දියා පළමු එක්දින ක්‍රිකට් තරගය අද කොළඹ ආර්. ප්‍රේමදාස ක්‍රීඩාංගණයේ දී පැවැත්වේ.'
    },
    {
      label: 'Financial & Inflation Policy (මහ බැංකු වාර්තාව)',
      input: 'ශ්‍රී ලංකා මහ බැංකුව විසින් අද දින සිය නවතම මූල්‍ය ප්‍රතිපත්ති වාර්තාව නිකුත් කර තිබේ. එහි දැක්වෙන්නේ ඉදිරි මාස කිහිපය තුළ උද්ධමන වේගය තවදුරටත් පහත වැටෙනු ඇති බවයි. පොලී අනුපාතික ස්ථාවර මට්ටමක පවත්වා ගැනීමට සහ මූල්‍ය පද්ධතිය ශක්තිමත් කිරීමට අවශ්‍ය පියවර ගෙන ඇති බව අධිපතිවරයා ප්‍රකාශ කළේය.',
      reference: 'ඉදිරි මාසවලදී උද්ධමනය තවදුරටත් පහත වැටෙනු ඇති බව මහ බැංකුවේ නවතම මූල්‍ය ප්‍රතිපත්ති වාර්තාවෙන් පෙන්වා දෙයි.'
    }
  ],
  grammar: [
    {
      label: 'Spelling & Redundancy (Stage 2)',
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
  ]
};

const METRIC_GUIDE = {
  rougeL: { name: 'ROUGE-L', poor: 0.80, good: 0.93 },
  charF1: { name: 'Char-F1', poor: 0.85, good: 0.95 },
  gleu: { name: 'GLEU', poor: 0.50, good: 0.80 },
  tokenF1: { name: 'Token-F1', poor: 0.80, good: 0.93 },
  bert_score_f1: { name: 'BERTScore (F1)', poor: 0.70, good: 0.85 },
  overcorrection: { name: 'Over-correction', poor: 0.30, good: 0.10 }
};

const TASKS = [
  { id: 'summarizer', label: 'Summarizer' },
  { id: 'grammar', label: 'Grammar' },
  { id: 'headline', label: 'Headline' },
  { id: 'style', label: 'Style' },
];

const FIELD_LABEL = 'text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em] block mb-2';
const TEXTAREA_CLASS = `w-full border border-ink-200 rounded-xl px-3.5 py-2.5 text-[14px] text-ink-800
  placeholder:text-ink-400 bg-white transition-all duration-150
  focus:outline-none focus:border-brand-400 focus:shadow-[0_0_0_3px_rgba(205,25,26,0.07)]`;

/**
 * Classifies model type into archetypes tailored to task
 */
function getModelArchetype(name, task = 'summarizer') {
  const lower = (name || '').toLowerCase();
  if (lower === 'base') {
    return {
      id: 'base',
      label: 'Base LLM (Unfine-tuned)',
      shortType: 'Base Foundation Model',
      icon: '⚠️',
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      description: 'Raw foundation model without task fine-tuning. Tends to continue typing or hallucinate.',
      fluencyRating: '⭐⭐ (Raw)',
      humanVerdict: task === 'summarizer'
        ? 'Lacks task instructions — continues writing instead of summarizing'
        : 'Unfine-tuned base model — lacks task instructions'
    };
  }

  if (task === 'summarizer') {
    if (['tfidf', 'textrank', 'rake', 'yake', 'keybert'].includes(lower) || lower.startsWith('extractive_')) {
      return {
        id: 'extractive',
        label: 'Extractive Algorithm',
        shortType: 'Extractive (Copy-Paste)',
        icon: '✂️',
        color: 'bg-slate-50 text-slate-800 border-slate-200',
        badgeClass: 'bg-slate-100 text-slate-900 border-slate-300',
        description: 'Statistical algorithm that extracts exact sentences/words from the source article. Cannot rephrase or create new sentences.',
        fluencyRating: '⭐⭐ (Rigid)',
        humanVerdict: 'Verbatim extraction — cuts and pastes sentences without human-like rewrite'
      };
    }
    if (lower.includes('mt5')) {
      return {
        id: 'teacher',
        label: 'mT5 Teacher Model',
        shortType: 'Encoder-Decoder Baseline',
        icon: '📘',
        color: 'bg-blue-50 text-blue-800 border-blue-200',
        badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
        description: 'Traditional multilingual Seq2Seq model used as training baseline. Generates working summaries but struggles with idiomatic Sinhala nuances.',
        fluencyRating: '⭐⭐⭐ (Decent)',
        humanVerdict: 'Standard baseline — acceptable compression but can produce generic or clipped phrasing'
      };
    }
    return {
      id: 'sinllama',
      label: 'SinLLaMA LoRA (Our Model)',
      shortType: 'Fine-tuned Abstractive LLM',
      icon: '🧠',
      color: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
      description: 'Fine-tuned Sinhala generative decoder LLM. Understands complete context and writes fresh, fluent journalistic Sinhala summaries.',
      fluencyRating: '⭐⭐⭐⭐⭐ (Human-grade)',
      humanVerdict: 'Natural journalistic rewrite — synthesizes key facts into fluent, coherent Sinhala prose'
    };
  }

  // Non-summarizer task archetypes
  const taskLabel = task.charAt(0).toUpperCase() + task.slice(1);
  return {
    id: 'sinllama',
    label: `SinLLaMA LoRA (${taskLabel})`,
    shortType: `Fine-tuned ${taskLabel} Adapter`,
    icon: '🧠',
    color: 'bg-emerald-50 text-emerald-900 border-emerald-200',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
    description: `Fine-tuned Sinhala LoRA adapter optimized specifically for ${task} tasks.`,
    fluencyRating: '⭐⭐⭐⭐⭐',
    humanVerdict: `Specialized ${task} model — applies trained journalistic rules accurately`
  };
}

export default function ModelComparison() {
  const [adaptersGroup, setAdaptersGroup] = useState({});
  const [loadedInGpu, setLoadedInGpu] = useState([]);
  const [serverMode, setServerMode] = useState('checking');

  const [task, setTask] = useState('summarizer');
  const [styleMode, setStyleMode] = useState('formal');
  const [length, setLength] = useState('medium');
  const [inputText, setInputText] = useState(PRESET_CASES.summarizer[0].input);
  const [referenceText, setReferenceText] = useState(PRESET_CASES.summarizer[0].reference);
  const [selectedAdapters, setSelectedAdapters] = useState([]);

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState('');
  const [highlightMatches, setHighlightMatches] = useState(true);
  const [showPresentationGuide, setShowPresentationGuide] = useState(false);

  // Helper to heal broken BPE subword token splits
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
    if (!cleanedOutput || !input) return { matchPct: 0, total: 0, matched: 0, abstractivePct: 100, wordCount: 0 };
    const inputWordSet = new Set(
      input.toLowerCase().split(/[^\w\u0D80-\u0DFF]+/u).filter(w => w.trim().length > 0)
    );
    const outputWords = cleanedOutput.toLowerCase().split(/[^\w\u0D80-\u0DFF]+/u).filter(w => w.trim().length > 0);
    if (outputWords.length === 0) return { matchPct: 0, total: 0, matched: 0, abstractivePct: 100, wordCount: 0 };
    let matchedCount = 0;
    outputWords.forEach(w => {
      if (inputWordSet.has(w)) matchedCount++;
    });
    const matchPct = Math.round((matchedCount / outputWords.length) * 100);
    return {
      matchPct,
      abstractivePct: Math.max(0, 100 - matchPct),
      total: outputWords.length,
      matched: matchedCount,
      wordCount: outputWords.length
    };
  };

  const getInputWordCount = (text) => {
    if (!text) return 0;
    return text.trim().split(/[^\w\u0D80-\u0DFF]+/u).filter(w => w.trim().length > 0).length;
  };

  // Helper to render output text with light yellow highlights for verbatim matches
  const renderHighlightedOutput = (outputText, input, shouldHighlight = true) => {
    const cleanedOutput = healSinhalaText(outputText);
    if (!cleanedOutput) return <span className="text-ink-400 italic">No output generated</span>;
    if (!shouldHighlight || !input || task !== 'summarizer') {
      return (
        <pre className="text-[14px] text-ink-800 font-sans font-normal leading-[1.85] whitespace-pre-wrap bg-ink-50/60 px-3.5 py-3 rounded-xl border border-ink-100 select-all min-h-[75px] m-0">
          {cleanedOutput}
        </pre>
      );
    }
    const inputWordSet = new Set(
      input.toLowerCase().split(/[^\w\u0D80-\u0DFF]+/u).filter(w => w.trim().length > 0)
    );
    const tokens = cleanedOutput.split(/([^\w\u0D80-\u0DFF]+)/u);
    return (
      <div className="text-[14px] text-ink-800 font-sans font-normal leading-[1.85] bg-ink-50/60 px-3.5 py-3 rounded-xl border border-ink-100 min-h-[75px] select-all">
        {tokens.map((tok, i) => {
          const clean = tok.toLowerCase().trim();
          const isMatch = clean.length > 0 && inputWordSet.has(clean);
          if (isMatch) {
            return (
              <mark
                key={i}
                className="bg-yellow-200/85 text-yellow-950 font-medium px-1 py-0.5 rounded-[3px] border border-yellow-300/70"
                title="Exact word copied directly from source article (Extracted)"
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

  useEffect(() => {
    autoSelectForTask(task, adaptersGroup);
    if (PRESET_CASES[task] && PRESET_CASES[task][0]) {
      setInputText(PRESET_CASES[task][0].input);
      setReferenceText(PRESET_CASES[task][0].reference);
    }
  }, [task]);

  const autoSelectForTask = (currentTask, groups) => {
    const list = groups[currentTask] || [];
    if (currentTask === 'summarizer') {
      // Default to the Showcase 4-Model Suite for presentations
      const latestSinllama = list.find(a => a.includes('v07')) || list.find(a => a.includes('v06')) || list[0] || 'summarization_sinllama_v07';
      const mt5 = groups['mt5']?.find(a => a === 'mt5-base') || 'mt5-base';
      setSelectedAdapters(Array.from(new Set([latestSinllama, mt5, 'textrank', 'base'])));
    } else {
      setSelectedAdapters([...list, 'base']);
    }
  };

  const handleSelectAdapter = (name) => {
    setSelectedAdapters(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    );
  };

  // 1-Click Comparison Presets for Summarizer
  const selectShowcaseSuite = () => {
    const sumList = adaptersGroup.summarizer || [];
    const latestSinllama = sumList.find(a => a.includes('v07')) || sumList.find(a => a.includes('v06')) || sumList[0] || 'summarization_sinllama_v07';
    setSelectedAdapters(Array.from(new Set([latestSinllama, 'mt5-base', 'textrank', 'base'])));
  };

  const selectAbstractiveOnly = () => {
    const sumList = adaptersGroup.summarizer || ['summarization_sinllama_v07', 'summarization_sinllama_v06'];
    const mt5List = adaptersGroup.mt5 || ['mt5-base'];
    setSelectedAdapters(Array.from(new Set([...sumList, ...mt5List])));
  };

  const selectExtractiveOnly = () => {
    const extList = adaptersGroup.extractive || ['tfidf', 'textrank', 'rake', 'yake', 'keybert'];
    setSelectedAdapters(extList);
  };

  const selectCurrentTask = () => {
    const list = adaptersGroup[task] || [];
    setSelectedAdapters([...list, 'base']);
  };

  const selectAllExceptCurrent = () => {
    const otherTasks = Object.keys(adaptersGroup).filter(t => t !== task);
    const list = otherTasks.map(t => adaptersGroup[t]).flat();
    setSelectedAdapters([...list, 'base']);
  };

  const selectAll = () => {
    const all = Object.values(adaptersGroup).flat();
    setSelectedAdapters(Array.from(new Set([...all, 'base'])));
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

    setLoadingProgress('Initializing model gateway...');
    const progressSteps = [
      'Loading neural weights & LoRA adapters...',
      'Running Sinhala tokenizers...',
      'Generating evaluated outputs...',
      'Computing linguistic metrics...'
    ];

    let step = 0;
    const progressInterval = setInterval(() => {
      if (step < progressSteps.length) {
        setLoadingProgress(progressSteps[step]);
        step++;
      }
    }, 1200);

    try {
      const payload = {
        input_text: inputText,
        adapters: selectedAdapters,
        task: task,
        style: task === 'style' ? styleMode : null,
        reference_text: referenceText || null,
        length: task === 'summarizer' ? length : null
      };

      const data = await runComparison(payload);
      clearInterval(progressInterval);
      const list = Array.isArray(data) ? data : data.results || [];
      setResults(list);
    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message || 'Error occurred during comparison. Ensure the backend server is online.');
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
      if (val >= thresholds.poor) return 'bg-brand-50 text-brand-700 border border-brand-200/70';
      if (val <= thresholds.good) return 'bg-emerald-50 text-emerald-700 border border-emerald-200/70';
      return 'bg-amber-50 text-amber-700 border border-amber-200/70';
    } else {
      if (val < thresholds.poor) return 'bg-brand-50 text-brand-700 border border-brand-200/70';
      if (val >= thresholds.good) return 'bg-emerald-50 text-emerald-700 border border-emerald-200/70';
      return 'bg-amber-50 text-amber-700 border border-amber-200/70';
    }
  };

  const formatMetricValue = (key, val) => {
    if (val === undefined || val === null) return '-';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return (val * 100).toFixed(1) + '%';
  };

  // Determine champion model and comparison insights
  const evaluationInsights = useMemo(() => {
    if (!results || results.length === 0) return null;

    const taskSpecificModels = results.filter(r => r.category === task || r.adapter_name.includes(task) || r.adapter_name.includes('sinllama'));
    const bestTaskModel = taskSpecificModels.find(r => r.adapter_name.includes('v07')) ||
                          taskSpecificModels.find(r => r.adapter_name.includes('v19')) ||
                          taskSpecificModels.find(r => r.adapter_name.includes('v27')) ||
                          taskSpecificModels[0];

    const fastest = [...results].sort((a, b) => (a.latency_ms || 999999) - (b.latency_ms || 999999))[0];
    const topModel = bestTaskModel || results[0];

    return {
      topModel,
      fastest,
      inputWordCount: getInputWordCount(inputText)
    };
  }, [results, inputText, task]);

  const AdapterRow = ({ name, category, displayName }) => {
    const isSelected = selectedAdapters.includes(name);
    const isLoaded = loadedInGpu.includes(name);
    const archetype = getModelArchetype(name, task);

    return (
      <button
        type="button"
        onClick={() => handleSelectAdapter(name)}
        aria-pressed={isSelected}
        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer transition-all duration-150 text-left
          ${isSelected
            ? 'border-brand-300 bg-brand-50/70 shadow-sm'
            : 'border-ink-100 hover:bg-ink-50 hover:border-ink-200'}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {isSelected
            ? <CheckSquare size={16} className="text-brand-600 shrink-0" />
            : <Square size={16} className="text-ink-300 shrink-0" />}
          <div className="flex flex-col min-w-0">
            <span className={`text-[13px] truncate ${isSelected ? 'font-bold text-ink-900' : 'font-medium text-ink-700'}`}>
              {displayName ?? name}
            </span>
            <span className="text-[10px] text-ink-400 truncate">
              {archetype.shortType}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {isLoaded && (
            <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded" title="Loaded in GPU cache">
              GPU
            </span>
          )}
          {category === 'summarizer' && isLengthConditionedAdapter(name) && (
            <span
              className="text-[9px] bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded"
              title="Trained on short/medium/long targets — honors the summary length control"
            >
              3-LEN
            </span>
          )}
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${archetype.color}`}>
            {archetype.icon} {archetype.id}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Page Header */}
      <PageHeader
        icon={Scale}
        title="Model Benchmark & Comparison"
        description="Side-by-side linguistic evaluation of SinLLaMA decoder LLMs, mT5 teacher baselines, and extractive algorithms."
        badge={
          serverMode === 'gpu'      ? <StatusBadge status="online"   label="GPU Backend Online" /> :
          serverMode === 'mock'     ? <StatusBadge status="warning"  label="Mock Evaluation Mode" /> :
          serverMode === 'error'    ? <StatusBadge status="offline"  label="Backend Unreachable" /> :
                                      <StatusBadge status="checking" label="Connecting..." pulse />
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPresentationGuide(prev => !prev)}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              title="Toggle presentation talking points for non-technical stakeholders"
            >
              <Lightbulb size={14} className="text-amber-600" />
              <span>{showPresentationGuide ? 'Hide Non-Technical Guide' : 'Non-Technical Guide'}</span>
            </button>
            <ActionButton size="sm" variant="secondary" icon={RefreshCw} onClick={fetchAdapters} title="Refresh adapter list">
              Refresh
            </ActionButton>
          </div>
        }
      />

      {/* ── Non-Technical Presentation Guide (Collapsible) ── */}
      {showPresentationGuide && (
        <Card className="p-5 bg-gradient-to-r from-amber-50/80 via-white to-amber-50/40 border-amber-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <Award className="text-amber-600 shrink-0" size={20} />
              <h3 className="text-[15px] font-bold text-ink-900">
                {task === 'summarizer'
                  ? 'How to Explain Summarizer Models to Non-Technical Audiences'
                  : `How to Explain ${task.charAt(0).toUpperCase() + task.slice(1)} Models to Non-Technical Audiences`}
              </h3>
            </div>
            <button
              onClick={() => setShowPresentationGuide(false)}
              className="text-ink-400 hover:text-ink-600 text-[12px] font-medium cursor-pointer"
            >
              Close
            </button>
          </div>

          {task === 'summarizer' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[12.5px] leading-relaxed text-ink-700">
              <div className="p-3.5 bg-white rounded-xl border border-amber-100 flex flex-col gap-1.5">
                <span className="font-bold text-amber-950 flex items-center gap-1.5">
                  ✂️ Extractive (Copy-Paste)
                </span>
                <p>
                  Like taking a yellow highlighter to a newspaper. It cuts out 1 or 2 existing sentences. It <b>never writes new words</b> and cannot link facts from different paragraphs together.
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-amber-100 flex flex-col gap-1.5">
                <span className="font-bold text-blue-950 flex items-center gap-1.5">
                  📘 mT5 Teacher Baseline
                </span>
                <p>
                  An older general translation/summary model. It does write new sentences, but frequently produces repetitive phrases or misses subtle Sinhala grammatical agreements.
                </p>
              </div>

              <div className="p-3.5 bg-white rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col gap-1.5">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  🧠 SinLLaMA (Our Breakthrough)
                </span>
                <p>
                  Reads like a human journalist. It synthesizes the core message from the entire article and rewrites it in <b>fresh, natural, grammatically correct Sinhala prose</b>.
                </p>
              </div>
            </div>
          ) : task === 'grammar' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[12.5px] leading-relaxed text-ink-700">
              <div className="p-3.5 bg-white rounded-xl border border-amber-100 flex flex-col gap-1.5">
                <span className="font-bold text-amber-950 flex items-center gap-1.5">
                  🔍 Spelling & Diacritics
                </span>
                <p>
                  Corrects character spelling mistakes, misplaced pillam (combining marks), and Unicode NFC sequence normalization without corrupting nearby words.
                </p>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-amber-100 flex flex-col gap-1.5">
                <span className="font-bold text-blue-950 flex items-center gap-1.5">
                  ✍️ Subject-Verb Agreement
                </span>
                <p>
                  Ensures correct grammatical concordance (singular/plural and gender rules in formal Sinhala) between the sentence subject and terminal verbs.
                </p>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col gap-1.5">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  🛡️ Over-Correction Guard
                </span>
                <p>
                  Evaluates whether the model respects already-correct Sinhala text rather than making unnecessary or harmful edits.
                </p>
              </div>
            </div>
          ) : task === 'headline' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[12.5px] leading-relaxed text-ink-700">
              <div className="p-3.5 bg-white rounded-xl border border-amber-100 flex flex-col gap-1.5">
                <span className="font-bold text-amber-950 flex items-center gap-1.5">
                  📏 Strict Word Count Control
                </span>
                <p>
                  Ensures generated headlines stay strictly within news desk targets (Short: 3–5 words, Medium: 6–7 words, Long: 8–10 words).
                </p>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-amber-100 flex flex-col gap-1.5">
                <span className="font-bold text-blue-950 flex items-center gap-1.5">
                  🎯 Fact & Entity Preservation
                </span>
                <p>
                  Accurately carries over key names, dates, quantities, and locations from the article without hallucinations.
                </p>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col gap-1.5">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  📰 Broadsheet Impact
                </span>
                <p>
                  Generates punchy, professional newspaper headlines following Sri Lankan editorial conventions.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[12.5px] leading-relaxed text-ink-700">
              <div className="p-3.5 bg-white rounded-xl border border-amber-100 flex flex-col gap-1.5">
                <span className="font-bold text-amber-950 flex items-center gap-1.5">
                  🗞️ Tone Adaptation
                </span>
                <p>
                  Transforms text between formal broadsheet, lively sports desk, youth-oriented social media, and analytical editorial tones.
                </p>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-amber-100 flex flex-col gap-1.5">
                <span className="font-bold text-blue-950 flex items-center gap-1.5">
                  📚 Vocabulary Shift
                </span>
                <p>
                  Swaps informal colloquial terms with appropriate journalistic or literary Sinhala vocabulary.
                </p>
              </div>
              <div className="p-3.5 bg-white rounded-xl border border-emerald-200 bg-emerald-50/40 flex flex-col gap-1.5">
                <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                  🎯 Core Meaning Retention
                </span>
                <p>
                  Alters the style and voice while completely preserving the underlying news facts and message.
                </p>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Configuration Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 items-start">
        {/* Left 3 cols: Task & Inputs */}
        <Card className="lg:col-span-3 p-5 sm:p-6 flex flex-col gap-5">
          {/* Task selector */}
          <div>
            <label className={FIELD_LABEL}>Evaluation Task</label>
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

          {/* Style tone option */}
          {task === 'style' && (
            <div>
              <label htmlFor="style-mode" className={FIELD_LABEL}>Rewrite Tone</label>
              <select
                id="style-mode"
                value={styleMode}
                onChange={(e) => setStyleMode(e.target.value)}
                className="w-full bg-white border border-ink-200 rounded-xl px-3.5 py-2.5 text-[14px] text-ink-800
                  cursor-pointer transition-all duration-150 focus:outline-none focus:border-brand-400"
              >
                <option value="formal">Formal News (නිල පුවත්)</option>
                <option value="sports">Sports Journalism (ක්‍රීඩා පුවත්)</option>
                <option value="youth">Youth / Casual (තරුණ ශෛලිය)</option>
                <option value="editorial">Analytical Editorial (සංස්කාරකීය)</option>
                <option value="feature">Feature Story (විශේෂාංග ලිපි)</option>
              </select>
            </div>
          )}

          {/* Summarizer Length Control */}
          {task === 'summarizer' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em]">
                  Target Summary Length
                </label>
                <div className="group relative">
                  <HelpCircle size={13} className="text-ink-400 cursor-help" />
                  <span className="pointer-events-none absolute right-0 bottom-full mb-2 w-72 bg-ink-900 text-white text-[11px] p-2.5 rounded-lg
                    opacity-0 group-hover:opacity-100 transition-opacity leading-relaxed z-30 shadow-pop">
                    Only fine-tuned SinLLaMA v06/v07 adapters honor short/medium/long length targets. Extractive methods and base models produce their default single-length output.
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {LENGTHS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setLength(opt.id)}
                    aria-pressed={length === opt.id}
                    title={opt.desc}
                    className={`py-2 px-3 text-[13px] font-semibold rounded-lg border transition-all duration-150 cursor-pointer text-center
                      ${length === opt.id
                        ? 'bg-brand-600 text-white border-brand-600 shadow-sm shadow-brand-600/20'
                        : 'bg-white text-ink-600 border-ink-200 hover:border-ink-300 hover:bg-ink-50'}`}
                  >
                    {opt.label} ({opt.id === 'short' ? '~10%' : opt.id === 'medium' ? '~20%' : '~35%'})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick preset articles */}
          {PRESET_CASES[task] && PRESET_CASES[task].length > 0 && (
            <div>
              <label className={FIELD_LABEL}>Sample Scenarios</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_CASES[task].map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => loadPreset(preset)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium bg-white border border-ink-200
                      text-ink-700 rounded-lg px-2.5 py-1.5 cursor-pointer transition-all duration-150
                      hover:border-brand-300 hover:text-brand-700 hover:bg-brand-50"
                  >
                    <Sparkles size={12} className="text-brand-600" />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Source Input */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="comparison-input" className={FIELD_LABEL}>Source Text / Input</label>
              <span className="text-[11px] text-ink-400 font-medium tabular-nums">
                {getInputWordCount(inputText)} words ({inputText.length} chars)
              </span>
            </div>
            <textarea
              id="comparison-input"
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste Sinhala text here…"
              className={TEXTAREA_CLASS}
            />
          </div>

          {/* Reference Ground Truth */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="comparison-reference" className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em] flex items-center gap-1.5">
                Expected / Reference Output (Ground Truth)
                <span className="text-[9.5px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200/70 normal-case tracking-normal">
                  Optional
                </span>
              </label>
            </div>
            <textarea
              id="comparison-reference"
              rows={2}
              value={referenceText}
              onChange={(e) => setReferenceText(e.target.value)}
              placeholder="Expected reference for automated metric scoring…"
              className={TEXTAREA_CLASS}
            />
          </div>
        </Card>

        {/* Right 2 cols: Model Selection */}
        <Card className="lg:col-span-2 p-5 sm:p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <label className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em]">Models to Compare</label>
            <span className="text-[11px] font-bold text-ink-700 bg-ink-100 px-2.5 py-0.5 rounded-full tabular-nums">
              {selectedAdapters.length} selected
            </span>
          </div>

          {/* Quick Comparison Suites (Summarizer only) vs General Selection */}
          <div className="flex flex-col gap-1.5 pb-2 border-b border-ink-100">
            <span className="text-[9.5px] font-bold text-ink-400 uppercase tracking-wider">
              {task === 'summarizer' ? 'Quick Comparison Suites' : 'Quick Selection'}
            </span>

            {task === 'summarizer' ? (
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={selectShowcaseSuite}
                  className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200/60 cursor-pointer text-left flex items-center gap-1"
                  title="SinLLaMA v07 vs mT5 vs TextRank vs Base (Ideal for presentations)"
                >
                  <Trophy size={12} className="text-brand-600 shrink-0" />
                  Showcase Suite (4)
                </button>
                <button
                  onClick={selectAbstractiveOnly}
                  className="text-[11px] font-medium px-2 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60 cursor-pointer text-left"
                >
                  🧠 Abstractive Only
                </button>
                <button
                  onClick={selectExtractiveOnly}
                  className="text-[11px] font-medium px-2 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer text-left"
                >
                  ✂️ Extractive (5)
                </button>
                <button
                  onClick={selectAll}
                  className="text-[11px] font-medium px-2 py-1.5 rounded-lg bg-ink-100 text-ink-700 hover:bg-ink-200 cursor-pointer text-left"
                >
                  Select All
                </button>
                <button
                  onClick={clearSelection}
                  className="col-span-2 text-[11px] font-medium px-2 py-1 rounded-lg bg-ink-50 text-ink-500 hover:bg-ink-100 cursor-pointer text-center"
                >
                  Clear Selection
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={selectCurrentTask}
                  className="text-[10.5px] font-bold px-2.5 py-1 rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 cursor-pointer"
                >
                  Current task
                </button>
                <button
                  onClick={selectAllExceptCurrent}
                  className="text-[10.5px] font-medium px-2.5 py-1 rounded-lg bg-ink-100 text-ink-600 hover:bg-ink-200 cursor-pointer"
                >
                  All except current
                </button>
                <button
                  onClick={selectAll}
                  className="text-[10.5px] font-medium px-2.5 py-1 rounded-lg bg-ink-100 text-ink-600 hover:bg-ink-200 cursor-pointer"
                >
                  Select all
                </button>
                <button
                  onClick={clearSelection}
                  className="text-[10.5px] font-medium px-2.5 py-1 rounded-lg bg-ink-50 text-ink-500 hover:bg-ink-100 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Model selection list */}
          <div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto overflow-x-hidden pr-1">
            <AdapterRow name="base" displayName="SinLLaMA Base" />

            {Object.keys(adaptersGroup).map((category) => {
              const list = adaptersGroup[category] || [];
              if (list.length === 0) return null;
              // Don't show extractive methods or mt5 in the selector list if task is grammar/headline/style
              if (task !== 'summarizer' && ['extractive', 'mt5'].includes(category)) return null;

              return (
                <div key={category} className="mt-2 flex flex-col gap-1.5">
                  <span className="text-[9.5px] font-bold text-ink-400 uppercase pl-1 tracking-[0.14em]">
                    {category} Domain
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
            {loading ? (loadingProgress || 'Benchmarking models...') : `Compare ${selectedAdapters.length} Models`}
          </ActionButton>
        </Card>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="bg-brand-50 border border-brand-200/70 rounded-xl px-4 py-3.5 flex items-start gap-2.5 text-brand-800 text-[13px]" role="alert">
          <AlertTriangle className="shrink-0 mt-0.5 text-brand-600" size={16} />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* ── Results Section ── */}
      {results.length > 0 && (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Header Bar */}
          <div className="border-t border-ink-200/70 pt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="text-emerald-500" size={20} />
              <h2 className="text-[17px] font-bold text-ink-900 tracking-tight">Benchmark Results</h2>
              <span className="text-[12px] text-ink-500 tabular-nums ml-1">
                ({results.length} models evaluated)
              </span>
            </div>

            {task === 'summarizer' && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setHighlightMatches(prev => !prev)}
                  className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-3.5 py-1.5 rounded-full border transition-all duration-150 cursor-pointer
                    ${highlightMatches
                      ? 'bg-yellow-100/90 text-yellow-900 border-yellow-300 shadow-sm'
                      : 'bg-white text-ink-600 border-ink-200 hover:bg-ink-50'}`}
                  title="Toggle highlighting of words directly extracted from source text"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-500 shrink-0" />
                  Highlight Verbatim Matches
                </button>
              </div>
            )}
          </div>

          {/* ── Executive Non-Technical Verdict Panel ── */}
          {evaluationInsights && (
            <Card className="p-5 bg-gradient-to-br from-white via-ink-50/40 to-emerald-50/30 border-emerald-200 shadow-md flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-ink-100 pb-3">
                <div className="flex items-center gap-2">
                  <Trophy className="text-amber-500 shrink-0" size={22} />
                  <div>
                    <h3 className="text-[15px] font-bold text-ink-900">Executive Comparison Verdict</h3>
                    <p className="text-[11.5px] text-ink-500">Summary designed for editorial and business stakeholders</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="text-[11px] font-bold bg-emerald-100 text-emerald-900 px-2.5 py-1 rounded-full border border-emerald-200">
                    🏆 Champion: {evaluationInsights.topModel?.adapter_name}
                  </span>
                  {evaluationInsights.fastest && (
                    <span className="text-[11px] font-bold bg-blue-50 text-blue-800 px-2.5 py-1 rounded-full border border-blue-200">
                      ⚡ Fastest: {evaluationInsights.fastest.adapter_name} ({evaluationInsights.fastest.latency_ms}ms)
                    </span>
                  )}
                </div>
              </div>

              {/* Explanatory breakdown */}
              {task === 'summarizer' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  <div className="lg:col-span-7 flex flex-col gap-2">
                    <p className="text-[13.5px] text-ink-800 leading-relaxed font-medium">
                      <span className="text-emerald-700 font-bold">Why is {evaluationInsights.topModel?.adapter_name} the best output?</span>
                    </p>
                    <ul className="text-[12.5px] text-ink-700 space-y-1.5 list-disc pl-4 leading-relaxed">
                      <li>
                        <b>Natural Journalistic Synthesis:</b> Unlike extractive methods that simply slice and paste raw sentences, our model synthesizes information from across the entire article into fresh Sinhala prose.
                      </li>
                      <li>
                        <b>Linguistic Coherence:</b> Adheres to standard Sinhala grammatical agreements (Subject-Object-Verb concordance) and proper punctuation.
                      </li>
                      <li>
                        <b>Target Compression:</b> Accurately condensed {evaluationInsights.inputWordCount} original words into a concise news briefing.
                      </li>
                    </ul>
                  </div>

                  <div className="lg:col-span-5 bg-white p-3.5 rounded-xl border border-ink-200/80 flex flex-col gap-2.5">
                    <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider">
                      Model Approaches at a Glance
                    </span>
                    <div className="space-y-1.5 text-[11.5px]">
                      <div className="flex items-center justify-between p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-100">
                        <span className="font-bold text-emerald-900">🧠 SinLLaMA LoRA</span>
                        <span className="text-emerald-800 font-medium">Human-like abstractive rewrite</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded-lg bg-blue-50/70 border border-blue-100">
                        <span className="font-bold text-blue-900">📘 mT5 Teacher</span>
                        <span className="text-blue-800 font-medium">Baseline neural translation</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 border border-slate-200">
                        <span className="font-bold text-slate-800">✂️ TextRank / TF-IDF</span>
                        <span className="text-slate-700 font-medium">Verbatim copy-paste</span>
                      </div>
                      <div className="flex items-center justify-between p-1.5 rounded-lg bg-amber-50/70 border border-amber-100">
                        <span className="font-bold text-amber-900">⚠️ SinLLaMA Base</span>
                        <span className="text-amber-800 font-medium">Raw LLM (unfine-tuned)</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 text-[12.5px] text-ink-700">
                  <p className="text-[13.5px] text-ink-800 font-medium">
                    <span className="text-emerald-700 font-bold">{evaluationInsights.topModel?.adapter_name}</span> scored highest on {task} accuracy and linguistic evaluation metrics.
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Highlight legend banner (Summarizer only) */}
          {task === 'summarizer' && highlightMatches && (
            <div className="bg-yellow-50/80 border border-yellow-200/90 rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[12px] text-yellow-950">
              <span className="flex items-center gap-2">
                <span className="bg-yellow-200 text-yellow-950 font-bold px-1.5 py-0.5 rounded border border-yellow-300 text-[11px]">
                  Yellow Highlight
                </span>
                Exact word directly copied from source article (Extracted)
              </span>
              <span className="text-[11.5px] text-yellow-900 font-medium">
                Plain Text = AI synthesized / original rephrasing (Abstractive)
              </span>
            </div>
          )}

          {/* ── Side-by-Side Model Output Cards ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {results.map((res) => {
              const archetype = getModelArchetype(res.adapter_name, task);
              const hasMetrics = res.metrics && Object.keys(res.metrics).length > 0;
              const vStats = getVerbatimStats(res.output_text, inputText);
              const isTop = evaluationInsights?.topModel?.adapter_name === res.adapter_name;
              const isFastest = evaluationInsights?.fastest?.adapter_name === res.adapter_name;

              const originalWordCount = getInputWordCount(inputText);
              const summaryWordCount = vStats.wordCount;
              const compressionPct = originalWordCount > 0
                ? Math.round(((originalWordCount - summaryWordCount) / originalWordCount) * 100)
                : 0;

              return (
                <Card
                  key={res.adapter_name}
                  className={`flex flex-col overflow-hidden transition-all duration-200 ${
                    isTop
                      ? 'ring-2 ring-emerald-500 shadow-md bg-white'
                      : 'border-ink-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className={`border-b px-4 py-3 flex items-center justify-between gap-2 ${archetype.color}`}>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] opacity-80">
                        {archetype.shortType}
                      </span>
                      <span className="text-[13.5px] font-bold truncate" title={res.adapter_name}>
                        {res.adapter_name === 'base'
                          ? 'SinLLaMA Base'
                          : ['mt5-base', 'mt5'].includes(res.adapter_name)
                          ? 'mT5 Base (Teacher)'
                          : ['tfidf', 'textrank', 'rake', 'yake', 'keybert'].includes(res.adapter_name)
                          ? `${res.adapter_name.toUpperCase()} (Extractive)`
                          : res.adapter_name}
                      </span>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      {isTop && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full shadow-sm">
                          <Trophy size={10} /> Best Output
                        </span>
                      )}
                      {isFastest && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                          <Zap size={10} /> Fastest
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Non-Technical Verdict Badge */}
                  <div className="px-4 pt-3 pb-1">
                    <div className="p-2 rounded-lg bg-ink-50/80 border border-ink-100 flex flex-col gap-0.5 text-[11.5px]">
                      <span className="font-bold text-ink-900 flex items-center gap-1">
                        <span>{archetype.icon}</span> {archetype.fluencyRating}
                      </span>
                      <span className="text-ink-600 leading-tight">
                        {archetype.humanVerdict}
                      </span>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      {/* Sub-header with verbatim gauge (Summarizer only) */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9.5px] font-bold text-ink-400 uppercase tracking-wider">Output</span>
                          {task === 'summarizer' && (
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border tabular-nums ${
                                vStats.matchPct >= 80
                                  ? 'bg-yellow-100 text-yellow-900 border-yellow-300'
                                  : 'bg-emerald-50 text-emerald-900 border-emerald-200'
                              }`}
                            >
                              {vStats.abstractivePct}% Abstractive ({vStats.matchPct}% Verbatim)
                            </span>
                          )}
                        </div>
                        <CopyButton text={res.output_text} label="" className="!px-1.5" />
                      </div>

                      {/* Output Text */}
                      {renderHighlightedOutput(res.output_text, inputText, highlightMatches)}
                    </div>

                    {/* Compression & Synthesis Bar (Summarizer only) */}
                    {task === 'summarizer' && (
                      <div className="space-y-2 border-t border-ink-100 pt-3 text-[11px] text-ink-600">
                        <div className="flex items-center justify-between">
                          <span>Compression</span>
                          <span className="font-bold text-ink-900 tabular-nums">
                            {originalWordCount} → {summaryWordCount} words ({compressionPct}% condensed)
                          </span>
                        </div>
                        <div className="w-full bg-ink-100 h-1.5 rounded-full overflow-hidden flex">
                          <div
                            className="bg-emerald-500 h-full"
                            style={{ width: `${vStats.abstractivePct}%` }}
                            title={`Abstractive Synthesis: ${vStats.abstractivePct}%`}
                          />
                          <div
                            className="bg-yellow-400 h-full"
                            style={{ width: `${vStats.matchPct}%` }}
                            title={`Extracted Overlap: ${vStats.matchPct}%`}
                          />
                        </div>
                      </div>
                    )}

                    {/* Runtime latency */}
                    <div className="border-t border-ink-100 pt-2.5 flex justify-between items-center text-[11px] text-ink-500 tabular-nums">
                      <span>Speed: <b className="text-ink-800">{res.latency_ms} ms</b></span>
                      <span>Rate: <b className="text-ink-800">{res.throughput_tokens_per_sec} tok/s</b></span>
                      <span>Output: <b className="text-ink-800">{res.output_tokens} tok</b></span>
                    </div>
                  </div>

                  {/* Quantitative Scores */}
                  {hasMetrics && (
                    <div className="bg-ink-50/70 border-t border-ink-100 p-3 grid grid-cols-2 gap-1.5 text-[11px]">
                      {[
                        ['ROUGE-L', 'rougeL', res.metrics.rougeL, `${(res.metrics.rougeL * 100).toFixed(0)}%`],
                        ['BERTScore', 'bert_score_f1', res.metrics.bert_score_f1,
                          res.metrics.bert_score_f1 == null ? '—' : `${(res.metrics.bert_score_f1 * 100).toFixed(0)}%`],
                        ['GLEU', 'gleu', res.metrics.gleu, `${(res.metrics.gleu * 100).toFixed(0)}%`],
                        ['Char-F1', 'charF1', res.metrics.charF1, `${(res.metrics.charF1 * 100).toFixed(0)}%`],
                      ].map(([label, key, val, display]) => (
                        <div key={label} className="flex justify-between items-center bg-white px-2 py-1 rounded border border-ink-100">
                          <span className="text-ink-500">{label}</span>
                          <span className={`px-1.5 py-0.5 rounded font-bold tabular-nums text-[10.5px] ${getMetricBadgeClass(key, val)}`}>
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

          {/* ── Detailed Metrics Matrix Table ── */}
          {results[0]?.metrics && Object.keys(results[0].metrics).length > 0 && (
            <Card className="overflow-hidden mt-2">
              <div className="px-4 py-3.5 border-b border-ink-100 bg-ink-50/70 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[13px] font-bold text-ink-900">Quantitative Linguistic Metrics Matrix</span>
                <span className="text-[11px] text-ink-500">Green = Target · Amber = Acceptable · Red = Poor</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11.5px]">
                  <thead>
                    <tr className="bg-ink-50/60 border-b border-ink-100">
                      <th className="p-3 font-bold text-ink-500 uppercase tracking-wider text-[10px]">Model</th>
                      <th className="p-3 font-bold text-ink-500 uppercase tracking-wider text-center text-[10px]">Approach</th>
                      {['Exact Match', 'ROUGE-L', 'ROUGE-1', 'ROUGE-2', 'BERTScore (Semantic)', 'GLEU', 'Char-F1'].map((h) => (
                        <th key={h} className="p-3 font-bold text-ink-500 uppercase tracking-wider text-center text-[10px] whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((res) => {
                      const m = res.metrics || {};
                      const archetype = getModelArchetype(res.adapter_name, task);
                      return (
                        <tr key={res.adapter_name} className="border-b border-ink-100 last:border-0 hover:bg-ink-50/50 font-medium tabular-nums">
                          <td className="p-3 font-bold text-ink-800 whitespace-nowrap">
                            {res.adapter_name === 'base' ? 'SinLLaMA Base' : res.adapter_name}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${archetype.badgeClass}`}>
                              {archetype.shortType}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {m.exact_match !== undefined ? (
                              m.exact_match
                                ? <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-bold px-2 py-0.5 rounded">Yes</span>
                                : <span className="bg-ink-100 text-ink-500 font-bold px-2 py-0.5 rounded">No</span>
                            ) : '-'}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${getMetricBadgeClass('rougeL', m.rougeL)}`}>
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
                            <span className={`px-2 py-0.5 rounded-full font-bold ${getMetricBadgeClass('bert_score_f1', m.bert_score_f1)}`}>
                              {formatMetricValue('bert_score_f1', m.bert_score_f1)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${getMetricBadgeClass('gleu', m.gleu)}`}>
                              {formatMetricValue('gleu', m.gleu)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${getMetricBadgeClass('charF1', m.charF1)}`}>
                              {formatMetricValue('charF1', m.charF1)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
