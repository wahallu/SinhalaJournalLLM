import { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import ToolHeader from './components/ToolHeader';
import InputBox from './components/InputBox';
import OutputPanel from './components/OutputPanel';
import RightPanel from './components/RightPanel';
import Dashboard from './components/Dashboard';
import HistoryPage from './components/HistoryPage';
import SettingsPage from './components/SettingsPage';
import ProfilePage from './components/ProfilePage';
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
    outputType: 'list',
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

const TOOL_IDS = ['grammar', 'headlines', 'rewriter', 'summarizer'];

function App() {
  const [activeTool, setActiveTool] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settings, setSettings] = useState({
    tone: 'formal',
    length: 'short',
    count: 5,
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
        wrappedProcess((text) => generateHeadlines(text, settings.count));
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
        return <HistoryPage onSelectTool={handleSelectTool} />;
      case 'settings':
        return <SettingsPage />;
      case 'profile':
        return <ProfilePage />;
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
            />

            <div className="flex items-center gap-3 mt-4">
              <button
                id="btn-run"
                onClick={handleRun}
                disabled={loading || !input.trim()}
                className="px-6 py-2.5 bg-accent text-white text-base font-medium rounded-lg
                  hover:bg-accent-hover active:scale-[0.98]
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-all duration-100 cursor-pointer"
              >
                {config.actionLabel}
              </button>
              <button
                id="btn-clear"
                onClick={clear}
                disabled={loading}
                className="px-5 py-2.5 text-base font-medium text-gray-400 rounded-lg
                  hover:text-gray-600 hover:bg-gray-50
                  disabled:opacity-40 disabled:cursor-not-allowed
                  transition-colors duration-100 cursor-pointer"
              >
                Clear
              </button>
              <span className="text-sm text-gray-300 ml-auto hidden sm:inline">⌘ Enter</span>
            </div>

            <OutputPanel
              output={output}
              loading={loading}
              error={error}
              type={config.outputType}
            />
          </>
        );
    }
  };

  return (
    <div className="h-full flex">
      <Sidebar
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      <main className="flex-1 min-w-0 flex">
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 lg:pl-8">
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
      </main>
    </div>
  );
}

export default App;
