import { useState, useEffect, useRef } from 'react';
import { 
  Play, RefreshCw, Scale, Cpu, CheckCircle2, AlertTriangle, 
  Copy, Info, Sparkles, HelpCircle, ChevronRight, CheckSquare, Square
} from 'lucide-react';
import { getComparisonAdapters, runComparison } from '../services/api';

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
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [loadingProgress, setLoadingProgress] = useState('');

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
  }, []);

  // Update selection when task changes
  useEffect(() => {
    autoSelectForTask(task, adaptersGroup);
  }, [task, adaptersGroup]);

  const autoSelectForTask = (currentTask, groups) => {
    const list = groups[currentTask] || [];
    // Always preselect "base" as a point of reference
    setSelectedAdapters([...list, 'base']);
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

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Helper to color-code metric scores
  const getMetricBadgeClass = (metricKey, val) => {
    if (val === undefined || val === null) return 'bg-gray-100 text-gray-500';
    const thresholds = METRIC_GUIDE[metricKey];
    if (!thresholds) return 'bg-blue-50 text-blue-700';

    if (metricKey === 'overcorrection') {
      // For overcorrection, lower is better
      if (val >= thresholds.poor) return 'bg-red-50 text-red-700 border border-red-200';
      if (val <= thresholds.good) return 'bg-green-50 text-green-700 border border-green-200';
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    } else {
      // Normal metrics, higher is better
      if (val < thresholds.poor) return 'bg-red-50 text-red-700 border border-red-200';
      if (val >= thresholds.good) return 'bg-green-50 text-green-700 border border-green-200';
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    }
  };

  // Helper to render metric values
  const formatMetricValue = (key, val) => {
    if (val === undefined || val === null) return '-';
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return (val * 100).toFixed(1) + '%';
  };

  return (
    <div className="flex flex-col gap-6 max-w-full pb-10">
      {/* Page Header */}
      <div className="flex justify-between items-start flex-wrap gap-4 border-b border-gray-100 pb-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Scale className="text-[#cd191a]" size={26} />
            Research Model Comparison
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Compare model base capability with fine-tuned LoRA adapters. Track model improvement incrementally.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-3 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase flex items-center gap-1.5 
            ${serverMode === 'gpu' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
              serverMode === 'mock' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
              'bg-gray-50 text-gray-500 border border-gray-200'}`}>
            <Cpu size={14} />
            {serverMode === 'gpu' ? 'GPU Backend Online' : 
             serverMode === 'mock' ? 'Running in Mock Mode' : 'Checking GPU Server...'}
          </div>
          <button 
            onClick={fetchAdapters}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200"
            title="Refresh adapter list"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Main Settings Input Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* LEFT COLUMN: Inputs & Controls */}
        <div className="lg:col-span-3 flex flex-col gap-5 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          {/* Task Selectors */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Select Task Domain</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'grammar', label: 'Grammar' },
                { id: 'headline', label: 'Headline' },
                { id: 'style', label: 'Style' },
                { id: 'summarizer', label: 'Summarizer' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTask(t.id)}
                  className={`py-2 px-3 text-sm font-semibold rounded-xl border transition-all cursor-pointer text-center
                    ${task === t.id 
                      ? 'bg-[#cd191a] text-white border-transparent shadow-sm' 
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Style Mode (Conditional) */}
          {task === 'style' && (
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Rewrite Style Tone</label>
              <select 
                value={styleMode} 
                onChange={(e) => setStyleMode(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#cd191a]"
              >
                <option value="formal">Formal News (නිල පුවත්)</option>
                <option value="sports">Sports Journalism (ක්‍රීඩා පුවත්)</option>
                <option value="youth">Youth / Casual (තරුණ ශෛලිය)</option>
                <option value="editorial">Analytical Editorial (සංස්කාරකීය)</option>
                <option value="feature">Feature Story (විශේෂාංග ලිපි)</option>
              </select>
            </div>
          )}

          {/* Preset Buttons */}
          {PRESET_CASES[task] && PRESET_CASES[task].length > 0 && (
            <div>
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Quick Presets</label>
              <div className="flex flex-wrap gap-2">
                {PRESET_CASES[task].map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => loadPreset(preset)}
                    className="text-xs bg-gray-50 hover:bg-[#fef2f2] hover:text-[#cd191a] hover:border-[#fca5a5] text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles size={11} />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Text Box */}
          <div>
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">Input Sentence / Text</label>
            <textarea
              rows={3}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Enter Sinhala text to run inference..."
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#cd191a] focus:ring-1 focus:ring-[#cd191a]"
            />
          </div>

          {/* Reference Text Box (Optional) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                Expected / Reference Output
                <span className="text-[10px] bg-blue-50 text-blue-600 font-semibold px-2 py-0.5 rounded-full border border-blue-100">Optional</span>
              </label>
              <div className="group relative">
                <HelpCircle size={14} className="text-gray-400 cursor-pointer" />
                <span className="pointer-events-none absolute right-0 bottom-full mb-2 w-64 bg-slate-800 text-white text-[11px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity leading-relaxed z-30 shadow-md">
                  Supplying a ground truth reference output allows the backend to calculate quantitative BLEU/GLEU, F1, and over-correction metrics.
                </span>
              </div>
            </div>
            <textarea
              rows={2}
              value={referenceText}
              onChange={(e) => setReferenceText(e.target.value)}
              placeholder="Provide expected ground truth for automatic score evaluations..."
              className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-[#cd191a] focus:ring-1 focus:ring-[#cd191a]"
            />
          </div>
        </div>

        {/* RIGHT COLUMN: Adapter Checklist & Selector */}
        <div className="lg:col-span-2 flex flex-col bg-white p-6 rounded-2xl border border-gray-200 shadow-sm justify-between gap-5">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Select Models</label>
              <span className="text-xs font-bold text-gray-600 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                {selectedAdapters.length} Selected
              </span>
            </div>

            {/* Quick Multi-Select Controls (Responsive Pill Chips) */}
            <div className="flex flex-wrap gap-1.5 pb-3 border-b border-gray-100">
              <button 
                onClick={selectDomainSpecific} 
                className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-red-50 hover:bg-red-100 text-[#cd191a] transition-all cursor-pointer"
              >
                Current Task
              </button>
              <button 
                onClick={selectAllButDomainSpecific} 
                className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-orange-50 hover:bg-orange-100 text-orange-700 transition-all cursor-pointer"
              >
                All Except Current
              </button>
              <button 
                onClick={selectAll} 
                className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all cursor-pointer"
              >
                Select All
              </button>
              <button 
                onClick={clearSelection} 
                className="text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all cursor-pointer"
              >
                Clear All
              </button>
            </div>

            {/* List of Adapters (Scroll container with hidden horizontal overflow) */}
            <div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto overflow-x-hidden pr-1.5">
              
              {/* Base Model (Static option) */}
              <div 
                onClick={() => handleSelectAdapter('base')}
                className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all
                  ${selectedAdapters.includes('base') 
                    ? 'border-[#cd191a] bg-[#cd191a]/5 text-black' 
                    : 'border-gray-100 hover:bg-gray-50 text-gray-600'}`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {selectedAdapters.includes('base') ? (
                    <CheckSquare size={16} className="text-[#cd191a] shrink-0" />
                  ) : (
                    <Square size={16} className="text-gray-300 shrink-0" />
                  )}
                  <span className="text-xs font-semibold truncate">base (SinLLaMA Base)</span>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded border border-slate-200 shrink-0">Base</span>
              </div>

              {/* Categorized List */}
              {Object.keys(adaptersGroup).map(category => {
                const list = adaptersGroup[category] || [];
                if (list.length === 0) return null;
                return (
                  <div key={category} className="mt-1 flex flex-col gap-1.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase pl-1 tracking-wider mt-1">{category} Domain</span>
                    {list.map(name => {
                      const isSelected = selectedAdapters.includes(name);
                      const isLoaded = loadedInGpu.includes(name);
                      return (
                        <div
                          key={name}
                          onClick={() => handleSelectAdapter(name)}
                          className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-all
                            ${isSelected 
                              ? 'border-[#cd191a] bg-[#cd191a]/5 text-black' 
                              : 'border-gray-100 hover:bg-gray-50 text-gray-600'}`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isSelected ? (
                              <CheckSquare size={16} className="text-[#cd191a] shrink-0" />
                            ) : (
                              <Square size={16} className="text-gray-300" />
                            )}
                            <span className="text-xs font-medium truncate max-w-[200px] sm:max-w-[260px]">{name}</span>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0">
                            {isLoaded && (
                              <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded" title="Loaded in GPU Cache">GPU</span>
                            )}
                            <span className="text-[9px] bg-gray-100 text-gray-600 font-bold px-1.5 py-0.5 rounded border border-gray-200 uppercase">{category.substring(0,4)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Trigger Button */}
          <button
            onClick={handleCompare}
            disabled={loading || !inputText.trim() || selectedAdapters.length === 0}
            className="w-full bg-[#cd191a] hover:bg-[#a01010] active:scale-[0.98] transition-all text-white font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-red-200 mt-4 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="spin" size={16} />
                <span>{loadingProgress || 'Evaluating...'}</span>
              </>
            ) : (
              <>
                <Play size={16} fill="white" />
                <span>Run Model Comparison</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700 text-sm">
          <AlertTriangle className="shrink-0 mt-0.5" size={17} />
          <span>{error}</span>
        </div>
      )}

      {/* Comparative Evaluation Section */}
      {results.length > 0 && (
        <div className="flex flex-col gap-6">
          <div className="border-t border-gray-100 pt-6">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <CheckCircle2 className="text-emerald-500" size={20} />
              Evaluation Results
            </h2>
          </div>

          {/* Side-by-Side Response Panels */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((res, i) => {
              const hasMetrics = res.metrics && Object.keys(res.metrics).length > 0;
              const isBestLatency = results.every(other => other.latency_ms >= res.latency_ms);
              const isBestRougeL = hasMetrics && results.every(other => 
                !other.metrics || !other.metrics.rougeL || other.metrics.rougeL <= res.metrics.rougeL
              );

              return (
                <div key={res.adapter_name} className="flex flex-col bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
                  
                  {/* Card Header */}
                  <div className="bg-gray-50 border-b border-gray-100 p-4 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{res.category} model</span>
                      <span className="text-sm font-black text-gray-800 truncate max-w-[150px]" title={res.adapter_name}>
                        {res.adapter_name === 'base' ? 'SinLLaMA Base' : res.adapter_name}
                      </span>
                    </div>

                    <div className="flex gap-1.5">
                      {isBestLatency && (
                        <span className="text-[10px] bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5" title="Fastest inference speed">
                          🚀 Fast
                        </span>
                      )}
                      {isBestRougeL && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5" title="Highest semantic matches">
                          🏆 Best Match
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Generated Output */}
                  <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Output</span>
                        <button 
                          onClick={() => copyToClipboard(res.output_text, i)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-900 transition-colors"
                          title="Copy output text"
                        >
                          {copiedIndex === i ? (
                            <span className="text-[10px] font-bold text-green-600">Copied!</span>
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      </div>
                      <pre className="text-sm text-gray-900 font-normal leading-relaxed whitespace-pre-wrap font-sans bg-gray-50/50 p-3 rounded-xl border border-gray-100 select-all min-h-[70px]">
                        {res.output_text}
                      </pre>
                    </div>

                    {/* Metadata & Secondary Metrics */}
                    <div className="border-t border-gray-100 pt-3 flex flex-wrap justify-between items-center gap-2 text-xs text-gray-500">
                      <div>
                        Latency: <span className="font-bold text-gray-700">{res.latency_ms} ms</span>
                      </div>
                      <div>
                        Throughput: <span className="font-bold text-gray-700">{res.throughput_tokens_per_sec} tok/s</span>
                      </div>
                      <div>
                        Tokens: <span className="font-bold text-gray-700">{res.output_tokens} out</span>
                      </div>
                    </div>
                  </div>

                  {/* Reference Scores (Conditional Footer) */}
                  {hasMetrics && (
                    <div className="bg-slate-50 border-t border-gray-100 p-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-gray-100">
                        <span className="text-gray-500">ROUGE-L:</span>
                        <span className={`px-2 py-0.5 rounded font-black ${getMetricBadgeClass('rougeL', res.metrics.rougeL)}`}>
                          {(res.metrics.rougeL * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-gray-100">
                        <span className="text-gray-500">GLEU:</span>
                        <span className={`px-2 py-0.5 rounded font-black ${getMetricBadgeClass('gleu', res.metrics.gleu)}`}>
                          {(res.metrics.gleu * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-gray-100">
                        <span className="text-gray-500">Char-F1:</span>
                        <span className={`px-2 py-0.5 rounded font-black ${getMetricBadgeClass('charF1', res.metrics.charF1)}`}>
                          {(res.metrics.charF1 * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-gray-100">
                        <span className="text-gray-500">Over-corr:</span>
                        <span className={`px-2 py-0.5 rounded font-black ${getMetricBadgeClass('overcorrection', res.metrics.over_correction ? 1 : 0)}`}>
                          {res.metrics.over_correction ? 'Warning' : 'None'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Detailed Metric comparison matrix */}
          {results[0] && results[0].metrics && Object.keys(results[0].metrics).length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mt-2">
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-800">Quantitative Metrics Matrix</span>
                <span className="text-xs text-gray-400">Score guidelines: Green = Target Good, Orange = Acceptable, Red = Poor</span>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100/50 border-b border-gray-100">
                      <th className="p-3 font-bold text-gray-500 uppercase tracking-wider">Model Name</th>
                      <th className="p-3 font-bold text-gray-500 uppercase tracking-wider text-center">Exact Match</th>
                      <th className="p-3 font-bold text-gray-500 uppercase tracking-wider text-center">ROUGE-L</th>
                      <th className="p-3 font-bold text-gray-500 uppercase tracking-wider text-center">ROUGE-1</th>
                      <th className="p-3 font-bold text-gray-500 uppercase tracking-wider text-center">ROUGE-2</th>
                      <th className="p-3 font-bold text-gray-500 uppercase tracking-wider text-center">GLEU (BLEU)</th>
                      <th className="p-3 font-bold text-gray-500 uppercase tracking-wider text-center">Char-F1</th>
                      <th className="p-3 font-bold text-gray-500 uppercase tracking-wider text-center">Token-F1</th>
                      <th className="p-3 font-bold text-gray-500 uppercase tracking-wider text-center">Over-correction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((res) => {
                      const m = res.metrics || {};
                      return (
                        <tr key={res.adapter_name} className="border-b border-gray-100 hover:bg-gray-50/50 font-medium">
                          <td className="p-3 font-bold text-gray-700 whitespace-nowrap">
                            {res.adapter_name === 'base' ? 'SinLLaMA Base' : res.adapter_name}
                          </td>
                          <td className="p-3 text-center">
                            {m.exact_match !== undefined ? (
                              m.exact_match ? (
                                <span className="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded border border-green-200">Yes</span>
                              ) : (
                                <span className="bg-slate-100 text-slate-500 font-bold px-2 py-0.5 rounded border border-slate-200">No</span>
                              )
                            ) : '-'}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2.5 py-0.5 rounded-full font-bold ${getMetricBadgeClass('rougeL', m.rougeL)}`}>
                              {formatMetricValue('rougeL', m.rougeL)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="bg-gray-50 border border-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                              {formatMetricValue('rouge1', m.rouge1)}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="bg-gray-50 border border-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
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
                                <span className="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded border border-red-200 flex items-center justify-center gap-1 max-w-[90px] mx-auto">
                                  <AlertTriangle size={11} />
                                  Yes
                                </span>
                              ) : (
                                <span className="bg-green-100 text-green-800 font-bold px-2.5 py-0.5 rounded border border-green-200">No</span>
                              )
                            ) : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Metric Threshold Guidelines Block */}
          {results[0] && results[0].metrics && Object.keys(results[0].metrics).length > 0 && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-4 flex items-start gap-3">
              <Info className="text-blue-500 mt-0.5 shrink-0" size={17} />
              <div className="flex flex-col gap-1 text-xs text-blue-800">
                <span className="font-bold">Linguistic Benchmark Guide for Sinhala LLM:</span>
                <p className="leading-relaxed">
                  In a spelling and grammar correction task, a high <b>Char-F1 (&gt;95%)</b> indicates solid character spelling accuracy, while a high <b>ROUGE-L (&gt;93%)</b> confirms correct sentence structure. <b>Over-correction</b> highlights cases where the model incorrectly alters grammatically sound input and should be kept below 10% on test datasets.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
