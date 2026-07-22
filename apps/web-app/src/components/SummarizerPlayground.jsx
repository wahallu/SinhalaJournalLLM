import { useState, useEffect } from 'react';
import {
  FileText, Play, RotateCcw, Copy, Check, Sparkles, Zap, Trophy,
  Sliders, Activity, CheckCircle2, ShieldCheck, ChevronRight, Layers, Eye
} from 'lucide-react';
import { getComparisonAdapters, runComparison } from '../services/api';

const SAMPLE_ARTICLES = [
  {
    title: 'මාර්ග නඩත්තු ව්‍යාපෘතිය',
    text: 'බස්නාහිර පළාතේ ප්‍රධාන මාර්ග කිහිපයක් ප්‍රතිසංස්කරණය කිරීමේ විශාල ව්‍යාපෘතියක් ලබන සතියේ සිට ආරම්භ කිරීමට මහාමාර්ග අමාත්‍යාංශය තීරණය කර ඇත. මේ සඳහා රුපියල් මිලියන 500 ක මුදලක් වෙන්කර ඇති අතර ව්‍යාපෘතිය මාස 6 ක් ඇතුළත අවසන් කිරීමට නියමිතය. මෙමගින් නගරබද මාර්ග තදබදය සැලකිය යුතු ලෙස අඩුවනු ඇතැයි අපේක්ෂා කෙරේ.'
  },
  {
    title: 'සෞඛ්‍ය නීති සහ වෙළඳසැල් පරීක්ෂාව',
    text: 'පාරිභෝගික අධිකාරිය සහ මහජන සෞඛ්‍ය පරීක්ෂකවරුන් විසින් කොළඹ නගරයේ වෙළඳසැල් කිහිපයක් හදිසි පරීක්ෂාවකට ලක් කර ඇත. මෙහිදී සොයාගත් හානිකර ආහාර ද්‍රව්‍ය අඩංගු බෝතල් කිහිපයක් අත්අඩංගුවට ගෙන විනාශ කිරීමට පියවර ගන්නා ලදී. නීති විරෝධී ලෙස අලෙවි කළ වෙළෙන්දන්ට එරෙහිව අධිකරණමය ක්‍රියාමාර්ග ගැනීමට නියෝග කෙරුණි.'
  },
  {
    title: 'කෘෂිකාර්මික පොහොර සහනාධාරය',
    text: 'නව මහ කන්නය සඳහා ගොවීන් වෙත ලබාදෙන පොහොර සහනාධාරය ලබන සඳුදා සිට බෙදා හැරීමට කෘෂිකර්ම අමාත්‍යාංශය කටයුතු යොදා තිබේ. දිස්ත්‍රික් මට්ටමින් ස්ථාපිත ගොවිජන සේවා මධ්‍යස්ථාන හරහා මෙම සහනාධාර ලබාගත හැකිය. කාබනික සහ රසායනික පොහොර වර්ග දෙකම ගොවීන්ගේ කැමැත්ත පරිදි තෝරාගැනීමට අවස්ථාව සලසා දී ඇත.'
  }
];

const PRESETS = [
  {
    id: 'sinllama_vs_mt5',
    label: 'SinLLaMA vs mT5 vs Extractive',
    desc: 'SinLLaMA-v05, mT5-v01, mT5-Base, TextRank & Base',
    filter: (adapters) => {
      const selected = [];
      const sinllama = adapters.summarizer?.find(a => a.includes('v05')) || adapters.summarizer?.[0];
      if (sinllama) selected.push(sinllama);
      const mt5Lora = adapters.mt5?.find(a => a.includes('v01')) || adapters.mt5?.find(a => a !== 'mt5-base');
      if (mt5Lora) selected.push(mt5Lora);
      selected.push('mt5-base', 'textrank', 'base');
      return selected.filter(Boolean);
    }
  },
  {
    id: 'all_abstractive',
    label: 'Abstractive Models Only',
    desc: 'SinLLaMA-v05, SinLLaMA-v04, mT5-v01 & mT5-Base',
    filter: (adapters) => {
      const list = [...(adapters.summarizer || []), ...(adapters.mt5 || [])];
      return list.length ? list : ['summarization_sinllama_v05', 'mt5-base'];
    }
  },
  {
    id: 'all_extractive',
    label: 'Extractive Benchmark (5 Algorithms)',
    desc: 'TF-IDF, TextRank, RAKE, YAKE & KeyBERT',
    filter: () => ['tfidf', 'textrank', 'rake', 'yake', 'keybert']
  }
];

export default function SummarizerPlayground() {
  const [inputArticle, setInputArticle] = useState(SAMPLE_ARTICLES[0].text);
  const [selectedAdapters, setSelectedAdapters] = useState([]);
  const [adaptersGroup, setAdaptersGroup] = useState({});
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [highlightMatches, setHighlightMatches] = useState(true);

  // Fetch available summarization adapters on mount
  useEffect(() => {
    const init = async () => {
      try {
        const data = await getComparisonAdapters();
        const groups = data.adapters || {};
        setAdaptersGroup(groups);

        // Default selection: SinLLaMA v05/latest + mT5-v01 + mt5-base + TextRank + Base
        const defaultSinllama = groups.summarizer?.find(a => a.includes('v05')) || groups.summarizer?.[0] || 'summarization_sinllama_v05';
        const defaultMt5Lora = groups.mt5?.find(a => a.includes('v01')) || 'summarization_mt5_v01';
        const defaultExt = ['textrank', 'tfidf'];
        setSelectedAdapters(Array.from(new Set([defaultSinllama, defaultMt5Lora, 'mt5-base', ...defaultExt, 'base'])));
      } catch (err) {
        setError(err.message || 'Failed to load summarizer adapters.');
      }
    };
    init();
  }, []);

  const handleSelectPreset = (preset) => {
    const chosen = preset.filter(adaptersGroup);
    setSelectedAdapters(chosen);
  };

  const handleToggleAdapter = (adapterName) => {
    setSelectedAdapters(prev =>
      prev.includes(adapterName) ? prev.filter(a => a !== adapterName) : [...prev, adapterName]
    );
  };

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

  const getVerbatimStats = (outputText, input) => {
    const cleanedOutput = healSinhalaText(outputText);
    if (!cleanedOutput || !input) return { matchPct: 0, total: 0, matched: 0 };
    const inputWordSet = new Set(
      input.toLowerCase().split(/[^\w\u0D80-\u0DFF]+/u).filter(w => w.trim().length > 0)
    );
    const outputWords = cleanedOutput.toLowerCase().split(/[^\w\u0D80-\u0DFF]+/u).filter(w => w.trim().length > 0);
    let matched = 0;
    outputWords.forEach(w => {
      if (inputWordSet.has(w)) matched++;
    });
    const matchPct = outputWords.length > 0 ? Math.round((matched / outputWords.length) * 100) : 0;
    return { matchPct, total: outputWords.length, matched };
  };

  const renderHighlightedOutput = (outputText, input) => {
    const cleanedOutput = healSinhalaText(outputText);
    if (!cleanedOutput) return <span className="text-ink-400 italic">No output generated</span>;
    if (!highlightMatches) {
      return (
        <div className="text-[13.5px] text-ink-800 font-sans leading-[1.85] bg-ink-50/60 px-3.5 py-3 rounded-xl border border-ink-100 min-h-[70px]">
          {cleanedOutput}
        </div>
      );
    }

    const inputWordSet = new Set(
      input.toLowerCase().split(/[^\w\u0D80-\u0DFF]+/u).filter(w => w.trim().length > 0)
    );
    const tokens = cleanedOutput.split(/([^\w\u0D80-\u0DFF]+)/u);
    return (
      <div className="text-[13.5px] text-ink-800 font-sans leading-[1.85] bg-ink-50/60 px-3.5 py-3 rounded-xl border border-ink-100 min-h-[70px] select-all">
        {tokens.map((tok, i) => {
          const clean = tok.toLowerCase().trim();
          const isMatch = clean.length > 0 && inputWordSet.has(clean);
          if (isMatch) {
            return (
              <mark
                key={i}
                className="bg-yellow-200/90 text-yellow-950 font-medium px-1 py-0.5 rounded-[3px] border border-yellow-300/80"
                title="Verbatim match from input article (Extracted)"
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

  const handleRunComparison = async () => {
    if (!inputArticle.trim() || selectedAdapters.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const data = await runComparison({
        input_text: inputArticle,
        adapters: selectedAdapters,
        task: 'summarizer',
      });
      const list = Array.isArray(data) ? data : data.results || [];
      setResults(list);
    } catch (err) {
      setError(err.message || 'Error running summarization benchmark.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Compute best latency & highest ROUGE-L
  const bestLatency = results.length > 0 ? Math.min(...results.map(r => r.latency_ms || 999999)) : null;
  const bestRougeL = results.length > 0 ? Math.max(...results.map(r => r.metrics?.rougeL || 0)) : null;

  const allAvailableSummarizers = [
    ...(adaptersGroup.summarizer || []),
    ...(adaptersGroup.mt5 || []),
    ...(adaptersGroup.extractive || ['tfidf', 'textrank', 'rake', 'yake', 'keybert']),
    'base'
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-r from-ink-950 via-ink-900 to-brand-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-brand-500/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/30 text-brand-300 text-xs font-semibold uppercase tracking-wider">
              <Layers size={13} /> Exclusive Summarization Lab
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-serif tracking-tight text-white">
              Summarizer Benchmark Playground
            </h1>
            <p className="text-sm text-ink-300 max-w-2xl leading-relaxed">
              Compare <span className="text-brand-300 font-semibold">SinLLaMA Decoder LLMs</span>, <span className="text-brand-300 font-semibold">mT5 Teacher Models</span>, and <span className="text-brand-300 font-semibold">Extractive Algorithms</span> on Sinhala news summarization under identical evaluation conditions.
            </p>
          </div>
          <button
            onClick={handleRunComparison}
            disabled={loading || selectedAdapters.length === 0}
            className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-500 text-white font-medium px-6 py-3.5 rounded-xl shadow-lg shadow-brand-950/40 hover:shadow-brand-600/30 transition-all duration-200 disabled:opacity-50 cursor-pointer text-sm shrink-0"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Benchmarking ({selectedAdapters.length} models)...</span>
              </>
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                <span>Run Summarizer Comparison</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Input & Config Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Article */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-ink-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-ink-900 font-semibold text-sm">
              <FileText size={16} className="text-brand-600" />
              <span>Input News Article</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-400 font-medium">Sample Articles:</span>
              {SAMPLE_ARTICLES.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputArticle(sample.text)}
                  className="text-xs bg-ink-50 hover:bg-ink-100 text-ink-700 font-medium px-2.5 py-1 rounded-md border border-ink-200/80 transition-colors"
                >
                  #{idx + 1} {sample.title}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={inputArticle}
            onChange={(e) => setInputArticle(e.target.value)}
            rows={6}
            placeholder="ප්‍රවෘත්ති ලිපිය මෙතැනට ඇතුළත් කරන්න..."
            className="w-full text-sm text-ink-900 bg-ink-50/50 border border-ink-200 rounded-xl p-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all leading-relaxed"
          />
          <div className="flex items-center justify-between text-xs text-ink-400">
            <span>Length: {inputArticle.length} characters</span>
            <button
              onClick={() => setInputArticle('')}
              className="inline-flex items-center gap-1 hover:text-ink-600 transition-colors"
            >
              <RotateCcw size={12} /> Clear Input
            </button>
          </div>
        </div>

        {/* Quick Presets & Options */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-ink-100 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-ink-900 font-semibold text-sm">
                <Sliders size={16} className="text-brand-600" />
                <span>Quick Compare Presets</span>
              </div>
              <button
                onClick={() => setHighlightMatches(!highlightMatches)}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                  highlightMatches
                    ? 'bg-yellow-50 text-yellow-900 border-yellow-300'
                    : 'bg-ink-50 text-ink-600 border-ink-200'
                }`}
                title="Toggle yellow verbatim text highlights"
              >
                <Eye size={12} />
                <span>Yellow Highlight: {highlightMatches ? 'ON' : 'OFF'}</span>
              </button>
            </div>

            <div className="space-y-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  className="w-full text-left p-3 rounded-xl border border-ink-100 bg-ink-50/40 hover:bg-brand-50/40 hover:border-brand-200 transition-all duration-150 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-ink-900 group-hover:text-brand-700">
                      {preset.label}
                    </span>
                    <ChevronRight size={14} className="text-ink-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                  <p className="text-[11px] text-ink-400 mt-0.5">{preset.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Model Badges Checklist */}
          <div className="pt-3 border-t border-ink-100">
            <span className="text-xs font-semibold text-ink-700 block mb-2">Selected Summarizer Models ({selectedAdapters.length}):</span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {Array.from(new Set(allAvailableSummarizers)).map((name) => {
                const isSelected = selectedAdapters.includes(name);
                let label = name;
                if (name === 'base') label = 'SinLLaMA Base';
                else if (name === 'mt5-base') label = 'mT5 Base';
                else if (['tfidf', 'textrank', 'rake', 'yake', 'keybert'].includes(name)) label = `${name.toUpperCase()} (Ext)`;

                return (
                  <button
                    key={name}
                    onClick={() => handleToggleAdapter(name)}
                    className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition-all ${
                      isSelected
                        ? 'bg-brand-50 text-brand-800 border-brand-300 shadow-2xs'
                        : 'bg-ink-50/60 text-ink-400 border-ink-200/80 hover:text-ink-700'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}{label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend Notice */}
      {highlightMatches && (
        <div className="bg-yellow-50/80 border border-yellow-200/80 rounded-xl p-3.5 text-xs text-yellow-950 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="bg-yellow-200 text-yellow-950 px-2 py-0.5 rounded font-semibold border border-yellow-300">
              Yellow Highlight
            </span>
            <span>= Exact words copied verbatim from input text (Extracted). Plain text = Model rephrasing (Abstractive).</span>
          </div>
          <span className="text-[11px] text-yellow-800 font-medium hidden sm:inline">
            Higher verbatim % = Extractive • Lower verbatim % = Abstractive
          </span>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-medium">
          {error}
        </div>
      )}

      {/* Output Comparison Grid */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold font-serif text-ink-900 flex items-center gap-2">
              <Activity size={18} className="text-brand-600" />
              <span>Summarization Results ({results.length} Models)</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {results.map((res, idx) => {
              const vStats = getVerbatimStats(res.output_text, inputArticle);
              const isBestLatency = res.latency_ms && res.latency_ms === bestLatency;
              const isBestRougeL = res.metrics?.rougeL && res.metrics?.rougeL === bestRougeL;

              const isExtractive = ['tfidf', 'textrank', 'rake', 'yake', 'keybert'].includes(res.adapter_name);
              const isMt5 = res.adapter_name.toLowerCase().includes('mt5');

              let cardCategory = 'SinLLaMA Abstractive';
              if (isExtractive) cardCategory = 'Extractive Summarizer';
              else if (isMt5) cardCategory = 'mT5 Teacher Model';

              let cardTitle = res.adapter_name;
              if (res.adapter_name === 'base') cardTitle = 'SinLLaMA Base';
              else if (res.adapter_name === 'mt5-base') cardTitle = 'mT5 Base (Teacher)';
              else if (isExtractive) cardTitle = `${res.adapter_name.toUpperCase()} (Extractive)`;

              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow duration-200"
                >
                  {/* Card Header */}
                  <div className="p-4 bg-ink-50/50 border-b border-ink-100 flex items-center justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">
                        {cardCategory}
                      </span>
                      <span className="text-sm font-bold text-ink-900 truncate" title={cardTitle}>
                        {cardTitle}
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {isBestLatency && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-full">
                          <Zap size={10} /> Fastest
                        </span>
                      )}
                      {isBestRougeL && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2 py-0.5 rounded-full">
                          <Trophy size={10} /> Best ROUGE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Body / Output */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-ink-400 uppercase tracking-wider">Summary</span>
                        {vStats.total > 0 && (
                          <span
                            className={`text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border ${
                              vStats.matchPct >= 80
                                ? 'bg-yellow-100 text-yellow-900 border-yellow-300'
                                : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            }`}
                          >
                            {vStats.matchPct >= 80
                              ? `Extracted (${vStats.matchPct}% verbatim)`
                              : `Abstractive (${vStats.matchPct}% verbatim)`}
                          </span>
                        )}
                      </div>

                      {renderHighlightedOutput(res.output_text, inputArticle)}
                    </div>

                    {/* Metrics Row */}
                    <div className="space-y-2 pt-3 border-t border-ink-100">
                      {/* Speed & Tokens */}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs text-ink-600 bg-ink-50/40 p-2 rounded-xl border border-ink-100/80">
                        <div>
                          <span className="block text-[9.5px] text-ink-400 uppercase font-semibold">Latency</span>
                          <span className="font-bold text-ink-900 tabular-nums">{res.latency_ms} ms</span>
                        </div>
                        <div>
                          <span className="block text-[9.5px] text-ink-400 uppercase font-semibold">Speed</span>
                          <span className="font-bold text-ink-900 tabular-nums">{res.throughput_tokens_per_sec || 0} tok/s</span>
                        </div>
                        <div>
                          <span className="block text-[9.5px] text-ink-400 uppercase font-semibold">Tokens</span>
                          <span className="font-bold text-ink-900 tabular-nums">{res.output_tokens || 0} out</span>
                        </div>
                      </div>

                      {/* ROUGE Metrics */}
                      {res.metrics && Object.keys(res.metrics).length > 0 && (
                        <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-medium text-ink-700 bg-brand-50/30 p-2 rounded-xl border border-brand-100/60">
                          <div>
                            <span className="text-[9px] text-brand-600 block uppercase font-bold">ROUGE-1</span>
                            <span className="font-bold text-ink-900">{res.metrics.rouge1 ?? '-'}%</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-brand-600 block uppercase font-bold">ROUGE-2</span>
                            <span className="font-bold text-ink-900">{res.metrics.rouge2 ?? '-'}%</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-brand-600 block uppercase font-bold">ROUGE-L</span>
                            <span className="font-bold text-ink-900">{res.metrics.rougeL ?? '-'}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Copy Action */}
                  <div className="px-4 py-2.5 bg-ink-50/40 border-t border-ink-100 flex items-center justify-between">
                    <span className="text-[11px] text-ink-400 font-medium">Click to copy summary</span>
                    <button
                      onClick={() => handleCopy(res.output_text, idx)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check size={13} /> Copied
                        </>
                      ) : (
                        <>
                          <Copy size={13} /> Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
