import { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ToolHeader from './components/ToolHeader';
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
import { useToolProcessor } from './hooks/useToolProcessor';
import { checkGrammar, generateHeadlines, rewriteStyle, summarizeNews } from './services/api';
import { saveToHistory } from './components/HistoryPage';

const TOOL_CONFIG = {
  grammar: {
    title: 'Grammar Checker',
    description: 'Check and correct Sinhala grammar',
    placeholder: 'මෙහි ඔබගේ සිංහල වාක්‍යය ඇතුළත් කරන්න…',
    actionLabel: 'Correct',
    outputType: 'text',
  },
  headlines: {
    title: 'Headline Generator',
    description: 'Generate headline options from an article',
    placeholder: 'මෙහි ප්‍රවෘත්ති ලිපිය ඇතුළත් කරන්න…',
    actionLabel: 'Generate',
    outputType: 'headlines',
  },
  rewriter: {
    title: 'Style Rewriter',
    description: 'Rewrite text in a different tone',
    placeholder: 'නැවත ලිවීමට අවශ්‍ය පෙළ ඇතුළත් කරන්න…',
    actionLabel: 'Rewrite',
    outputType: 'text',
  },
  summarizer: {
    title: 'News Summarizer',
    description: 'Summarize long-form articles',
    placeholder: 'සාරාංශ කිරීමට ලිපිය ඇතුළත් කරන්න…',
    actionLabel: 'Summarize',
    outputType: 'text',
  },
};

const TOOL_IDS = ['grammar', 'headlines', 'rewriter', 'summarizer', 'plans', 'sinllama'];

function App() {
  const [activeTool, setActiveTool] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settings, setSettings] = useState({
    tone: 'formal',
    length: 'short',
    count: 3,
    headlineStyle: 'formal',
    headlineMaxLength: 80,
  });

  const { input, setInput, output, loading, error, process, clear } = useToolProcessor();

  const handleSelectTool = useCallback((toolId) => {
    setActiveTool(toolId);
    if (TOOL_IDS.includes(toolId)) {
      clear();
    }
  }, [clear]);

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
  const isTool = TOOL_IDS.includes(activeTool);

  const renderContent = () => {
    switch (activeTool) {
      case 'dashboard':
        return <Dashboard onSelectTool={handleSelectTool} />;
      case 'history':
        return <HistoryPage onSelectTool={handleSelectTool} onBack={() => handleSelectTool('dashboard')} />;
      case 'settings':
        return <SettingsPage onBack={() => handleSelectTool('dashboard')} />;
      case 'profile':
        return <ProfilePage onBack={() => handleSelectTool('dashboard')} />;
      case 'plans':
        return <Plans />;
      case 'sinllama':
        return <SinLLamaPage />;
      default:
        if (!config) return null;
        return (
          <>
            <ToolHeader title={config.title} description={config.description} />

            <InputBox
              value={input}
              onChange={setInput}
              placeholder={config.placeholder}
              onSubmit={handleRun}
              disabled={loading}
              activeTool={activeTool}
            />

            <div className="flex items-center gap-3 mt-4 justify-end w-full">
              <button
                id="btn-run"
                onClick={handleRun}
                disabled={loading || !input.trim()}
                className={`px-8 py-2 text-white text-[15px] font-semibold rounded-full shadow-sm
                  ${getButtonColor(activeTool)} active:scale-[0.98]
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-all duration-100 cursor-pointer`}
              >
                {config.actionLabel}
              </button>
              <button
                id="btn-clear"
                onClick={clear}
                disabled={loading}
                className={`px-6 py-2 text-[15px] font-semibold text-white rounded-full shadow-sm
                  ${getButtonColor(activeTool)} active:scale-[0.98]
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-all duration-100 cursor-pointer`}
              >
                Clear
              </button>
            </div>

            {/* Use dedicated panel for headlines, generic for others */}
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
              />
            )}
          </>
        );
    }
  };

  const getBgColor = () => {
    return 'bg-[#cd191a]';
  };

  const getButtonColor = (tool) => {
    switch (tool) {
      case 'dashboard': return 'bg-[#cd191a] hover:bg-[#cd191a]';
      case 'grammar': return 'bg-[#cd191a] hover:bg-[#cd191a]';
      case 'headlines': return 'bg-[#cd191a] hover:bg-[#cd191a]';
      case 'rewriter': return 'bg-[#cd191a] hover:bg-[#cd191a]';
      case 'summarizer': return 'bg-[#cd191a] hover:bg-[#cd191a]';
      case 'history': return 'bg-[#cd191a] hover:bg-[#cd191a]';
      case 'settings': return 'bg-[#cd191a] hover:bg-[#cd191a]';
      case 'profile': return 'bg-[#cd191a] hover:bg-[#cd191a]';
      case 'plans': return 'bg-[#cd191a] hover:bg-[#cd191a]';
      default: return 'bg-[#cd191a] hover:bg-[#cd191a]';
    }
  };

  return (
    <div className={`relative h-full flex ${getBgColor()} transition-colors duration-500 overflow-hidden`}>
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-center bg-repeat"
        style={{
          backgroundImage: "url('/t.svg')",
          backgroundSize: '2840px auto',
          opacity: 0.18,
        }}
      />

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
        ${sidebarCollapsed ? 'w-20' : 'w-[20rem]'}
      `} />

      <main className="relative z-10 flex-1 flex flex-col bg-[#f8fafc] rounded-[2rem] lg:rounded-tl-[3rem] lg:rounded-tr-none lg:rounded-bl-none lg:rounded-br-none my-2 mx-2 sm:my-4 sm:mr-4 sm:ml-0 shadow-2xl overflow-hidden">
        <div className="flex-1 flex min-w-0 overflow-y-auto">
          <div className="flex-1 min-w-0 flex justify-center">
            <div className="w-full max-w-4xl px-4 pt-16 pb-6 lg:pt-8 sm:px-8 sm:py-8">
              {renderContent()}
            </div>
          </div>

          {isTool && (
            <RightPanel
              activeTool={activeTool}
              settings={settings}
              onSettingsChange={setSettings}
              output={output}
              loading={loading}
              input={input}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
