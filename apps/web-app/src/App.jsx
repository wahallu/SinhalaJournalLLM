import { useState, useCallback } from 'react';
import { Menu } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { TOOL_META } from './lib/toolMeta';
import PageHeader from './components/ui/PageHeader';
import StatusBadge from './components/ui/StatusBadge';
import InputBox from './components/InputBox';
import OutputPanel from './components/OutputPanel';
import HeadlineOutputPanel from './components/HeadlineOutputPanel';
import RightPanel from './components/RightPanel';
import Dashboard from './components/Dashboard';
import HistoryPage from './components/HistoryPage';
import SettingsPage from './components/SettingsPage';
import ProfilePage from './components/ProfilePage';
import Plans from './components/Plans';
import SinLLamaPage from './components/SinLLamaPage';
import ModelComparison from './components/ModelComparison';
import SummarizerPlayground from './components/SummarizerPlayground';
import ImageGenerator from './components/ImageGenerator';
import { useToolProcessor } from './hooks/useToolProcessor';
import { checkGrammar, generateHeadlines, rewriteStyle, summarizeNews } from './services/api';
import { saveToHistory } from './lib/history';

const TOOL_CONFIG = {
  grammar: {
    title: TOOL_META.grammar.label,
    description: 'Detect and fix Sinhala spelling, grammar, and agreement issues before publishing.',
    placeholder: 'මෙහි ඔබගේ සිංහල වාක්‍යය ඇතුළත් කරන්න…',
    actionLabel: 'Correct',
    outputType: 'text',
    icon: TOOL_META.grammar.icon,
    helper: 'Paste or type Sinhala text to check grammar',
    sample: TOOL_META.grammar.sample,
  },
  headlines: {
    title: TOOL_META.headlines.label,
    description: 'Generate ranked Sinhala headline candidates from a full article.',
    placeholder: 'මෙහි ප්‍රවෘත්ති ලිපිය ඇතුළත් කරන්න…',
    actionLabel: 'Generate',
    outputType: 'headlines',
    icon: TOOL_META.headlines.icon,
    helper: 'Paste the full article to generate headlines',
    sample: TOOL_META.headlines.sample,
  },
  rewriter: {
    title: TOOL_META.rewriter.label,
    description: 'Rewrite copy for a different desk — formal, editorial, sports, feature, or youth.',
    placeholder: 'නැවත ලිවීමට අවශ්‍ය පෙළ ඇතුළත් කරන්න…',
    actionLabel: 'Rewrite',
    outputType: 'text',
    icon: TOOL_META.rewriter.icon,
    helper: 'Paste text to rewrite in a different tone',
    sample: TOOL_META.rewriter.sample,
  },
  summarizer: {
    title: TOOL_META.summarizer.label,
    description: 'Condense long-form Sinhala articles into publication-ready summaries.',
    placeholder: 'සාරාංශ කිරීමට ලිපිය ඇතුළත් කරන්න…',
    actionLabel: 'Summarize',
    outputType: 'text',
    icon: TOOL_META.summarizer.icon,
    helper: 'Paste the article to summarize',
    sample: TOOL_META.summarizer.sample,
  },
};

const TOOL_IDS = ['grammar', 'headlines', 'rewriter', 'summarizer', 'image_generator', 'plans', 'sinllama', 'comparison', 'summarizer_playground'];

const MAX_WIDTHS = {
  dashboard: 'max-w-7xl',
  grammar: 'max-w-7xl',
  headlines: 'max-w-7xl',
  rewriter: 'max-w-7xl',
  summarizer: 'max-w-7xl',
  image_generator: 'max-w-5xl',
  comparison: 'max-w-7xl',
  summarizer_playground: 'max-w-7xl',
  sinllama: 'max-w-5xl',
  history: 'max-w-4xl',
  settings: 'max-w-3xl',
  profile: 'max-w-3xl',
  plans: 'max-w-6xl',
};

function loadDefaultSettings() {
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem('sinai_settings') || '{}');
  } catch {
    stored = {};
  }
  return {
    tone: stored.defaultTone || 'formal',
    length: stored.defaultLength || 'short',
    count: stored.headlineCount || 3,
    headlineStyle: 'formal',
    headlineMaxLength: 80,
    summaryView: 'paragraph',
  };
}

function App() {
  const [activeTool, setActiveTool] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settings, setSettings] = useState(loadDefaultSettings);

  const { input, setInput, output, loading, error, process, clear } = useToolProcessor();

  const handleSelectTool = useCallback((toolId) => {
    setActiveTool(toolId);
    if (TOOL_IDS.includes(toolId)) {
      clear();
    }
  }, [clear]);

  // Open a tool with text prefilled (dashboard quick actions, history rerun)
  const handleQuickStart = useCallback((toolId, text = '') => {
    clear();
    setActiveTool(toolId);
    if (text) setInput(text);
  }, [clear, setInput]);

  // Settings page saved new defaults — reflect them in the live tool settings
  const handleDefaultsChange = useCallback((d) => {
    setSettings((prev) => ({
      ...prev,
      tone: d.defaultTone ?? prev.tone,
      length: d.defaultLength ?? prev.length,
      count: d.headlineCount ?? prev.count,
    }));
  }, []);

  const handleRun = useCallback(() => {
    if (!input.trim()) return;
    const wrappedProcess = async (apiCall) => {
      await process(async (text) => {
        const result = await apiCall(text);
        saveToHistory(activeTool, text, result);
        return result;
      });
    };

    switch (activeTool) {
      case 'grammar':
        wrappedProcess((text) => checkGrammar(text));
        break;
      case 'headlines':
        wrappedProcess((text) =>
          generateHeadlines(text, {
            style: settings.headlineStyle,
            maxLength: settings.headlineMaxLength,
            numCandidates: settings.count,
          })
        );
        break;
      case 'rewriter':
        wrappedProcess((text) => rewriteStyle(text, settings.tone));
        break;
      case 'summarizer':
        wrappedProcess((text) => summarizeNews(text, settings.length));
        break;
    }
  }, [activeTool, input, settings, process]);

  const config = TOOL_CONFIG[activeTool];
  const isChat = activeTool === 'sinllama';

  const renderContent = () => {
    switch (activeTool) {
      case 'dashboard':
        return <Dashboard onSelectTool={handleSelectTool} onQuickStart={handleQuickStart} />;
      case 'history':
        return (
          <HistoryPage
            onSelectTool={handleSelectTool}
            onRerun={handleQuickStart}
            onBack={() => handleSelectTool('dashboard')}
          />
        );
      case 'settings':
        return <SettingsPage onBack={() => handleSelectTool('dashboard')} onDefaultsChange={handleDefaultsChange} />;
      case 'profile':
        return <ProfilePage onBack={() => handleSelectTool('dashboard')} />;
      case 'plans':
        return <Plans />;
      case 'sinllama':
        return <SinLLamaPage />;
      case 'comparison':
        return <ModelComparison />;
      case 'summarizer_playground':
        return <SummarizerPlayground />;
      case 'image_generator':
        return <ImageGenerator />;
      default:
        if (!config) return null;
        return (
          <>
            <PageHeader
              icon={config.icon}
              title={config.title}
              description={config.description}
              badge={<StatusBadge status="brand" label="SinLLaMA adapter" />}
            />

            <div className="tool-grid">
              <div className="tg-input">
                <InputBox
                  value={input}
                  onChange={setInput}
                  placeholder={config.placeholder}
                  onSubmit={handleRun}
                  disabled={loading}
                  activeTool={activeTool}
                  helper={config.helper}
                  sample={config.sample}
                  actionLabel={config.actionLabel}
                  loading={loading}
                  onRun={handleRun}
                  onClear={clear}
                />
              </div>

              <div className="tg-panel">
                <div className="xl:sticky xl:top-6 space-y-4">
                  <RightPanel
                    activeTool={activeTool}
                    settings={settings}
                    onSettingsChange={setSettings}
                    output={output}
                    loading={loading}
                    input={input}
                  />
                </div>
              </div>

              <div className="tg-output">
                {activeTool === 'headlines' ? (
                  <HeadlineOutputPanel
                    output={output}
                    loading={loading}
                    error={error}
                    articleText={input}
                  />
                ) : (
                  <OutputPanel
                    output={output}
                    loading={loading}
                    error={error}
                    type={config.outputType}
                    activeTool={activeTool}
                    input={input}
                    summaryView={settings.summaryView}
                  />
                )}
              </div>
            </div>
          </>
        );
    }
  };

  return (
    <div className="relative h-full flex bg-canvas overflow-hidden">
      <Sidebar
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      {/* Desktop sidebar spacer — gives the fixed sidebar its flex-row space on lg+ */}
      <div className={`
        hidden lg:block shrink-0 transition-all duration-200
        ${sidebarCollapsed ? 'w-[4.75rem]' : 'w-[17rem]'}
      `} />

      <div className="flex-1 min-w-0 h-full flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 h-14 shrink-0 flex items-center gap-3 px-4
          bg-white/85 backdrop-blur border-b border-ink-200/70">
          <button
            id="sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-ink-600 hover:bg-ink-100 cursor-pointer"
            aria-label="Open navigation"
          >
            <Menu size={19} />
          </button>
          <div className="flex items-center gap-2.5">
            <img src="/logored.svg" alt="" className="w-6 h-6 object-contain" />
            <span className="text-[17px] text-ink-900 tracking-tight" style={{ fontFamily: "'Gwen', 'Satoshi', sans-serif" }}>
              SinAi
            </span>
          </div>
        </header>

        <main className={`flex-1 min-h-0 ${isChat ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
          <div
            key={activeTool}
            className={`mx-auto w-full ${MAX_WIDTHS[activeTool] ?? 'max-w-5xl'} px-4 sm:px-6 lg:px-8 py-6 lg:py-8
              animate-in fade-in slide-in-from-bottom-2 duration-300
              ${isChat ? 'flex-1 min-h-0 flex flex-col' : ''}`}
          >
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
