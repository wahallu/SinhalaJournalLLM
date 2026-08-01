import { useState, useCallback, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
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
import { useToolProcessor } from './hooks/useToolProcessor';
import { usePlatformMeta } from './hooks/usePlatformMeta';
import { checkGrammar, generateHeadlines, rewriteStyle, summarizeNews } from './services/api';
import ProtectedRoute from './auth/ProtectedRoute';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import ForgotPassword from './pages/auth/ForgotPassword';
import ResetPassword from './pages/auth/ResetPassword';
import VerifyEmail from './pages/auth/VerifyEmail';
import AdminRoute from './admin/AdminRoute';
import AdminLayout from './admin/AdminLayout';
import Overview from './admin/pages/Overview';
import AdminUsers from './admin/pages/Users';
import UserDetail from './admin/pages/UserDetail';
import Categories from './admin/pages/Categories';
import AdminSettings from './admin/pages/Settings';
import Activity from './admin/pages/Activity';
import SinLLamaPage from './admin/research/SinLLamaPage';
import SummarizerPlayground from './admin/research/SummarizerPlayground';
import ModelComparison from './admin/research/ModelComparison';

/* Auth screens render outside the sidebar shell. */
const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'];

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

const PATH_TO_TOOL = {
  '/grammar': 'grammar',
  '/headlines': 'headlines',
  '/rewriter': 'rewriter',
  '/summarizer': 'summarizer',
  '/history': 'history',
  '/settings': 'settings',
  '/profile': 'profile',
  '/plans': 'plans',
  '/dashboard': 'dashboard',
};

const TOOL_TO_PATH = {
  grammar: '/grammar',
  headlines: '/headlines',
  rewriter: '/rewriter',
  summarizer: '/summarizer',
  history: '/history',
  settings: '/settings',
  profile: '/profile',
  plans: '/plans',
  dashboard: '/dashboard',
};

const MAX_WIDTHS = {
  dashboard: 'max-w-7xl',
  grammar: 'max-w-7xl',
  headlines: 'max-w-7xl',
  rewriter: 'max-w-7xl',
  summarizer: 'max-w-7xl',
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
    // Left undefined when unset so the admin's global default can fill in.
    tone: stored.defaultTone,
    length: stored.defaultLength,
    count: stored.headlineCount,
    headlineStyle: 'formal',
    headlineMaxLength: 80,
    summaryView: 'paragraph',
  };
}

function ToolRunner({ activeTool, settings, setSettings }) {
  const location = useLocation();
  const config = TOOL_CONFIG[activeTool];
  const { input, setInput, output, loading, error, process, clear } = useToolProcessor();

  useEffect(() => {
    if (location.state?.text) {
      setInput(location.state.text);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, setInput]);

  const handleRun = useCallback(() => {
    if (!input.trim()) return;
    const wrappedProcess = async (apiCall) => {
      await process(async (text) => {
        // The backend persists every authenticated run itself, so there is
        // no client-side history store to keep in sync.
        return await apiCall(text);
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
            category: settings.category || 'General',
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

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settings, setSettings] = useState(loadDefaultSettings);
  const { features, defaults: globalDefaults } = usePlatformMeta();

  // Precedence: the user's own choice, then the admin's global default, then
  // a hardcoded fallback. Derived rather than synced into state, so a change
  // on either side is reflected without an effect writing back.
  const effectiveSettings = useMemo(() => ({
    ...settings,
    tone: settings.tone ?? globalDefaults?.tone ?? 'formal',
    length: settings.length ?? globalDefaults?.length ?? 'short',
    count: settings.count ?? globalDefaults?.headline_count ?? 3,
  }), [settings, globalDefaults]);

  const activeTool = PATH_TO_TOOL[location.pathname] || 'dashboard';

  const handleSelectTool = useCallback((toolId) => {
    const path = TOOL_TO_PATH[toolId] || `/${toolId}`;
    navigate(path);
  }, [navigate]);

  const handleQuickStart = useCallback((toolId, text = '') => {
    const path = TOOL_TO_PATH[toolId] || `/${toolId}`;
    navigate(path, { state: { text } });
  }, [navigate]);

  /**
   * Store only the values the user actually changed.
   *
   * RightPanel echoes the whole resolved settings object back on every
   * edit. Merging that verbatim wrote the resolved defaults into state, so
   * `settings.tone ?? globalDefaults.tone` stopped falling through and the
   * admin's global default was permanently replaced by whatever had been
   * resolved at that moment — often the hardcoded fallback, if /meta had not
   * arrived yet. Comparing against the resolved value makes the echo a no-op.
   */
  const handleSettingsChange = useCallback((next) => {
    setSettings((prev) => {
      const merged = { ...prev };
      for (const [key, value] of Object.entries(next)) {
        if (value !== effectiveSettings[key]) merged[key] = value;
      }
      return merged;
    });
  }, [effectiveSettings]);

  const handleDefaultsChange = useCallback((d) => {
    setSettings((prev) => ({
      ...prev,
      tone: d.defaultTone ?? prev.tone,
      length: d.defaultLength ?? prev.length,
      count: d.headlineCount ?? prev.count,
    }));
  }, []);

  const isChat = false; // the playground now lives under /admin/research

  /* Hiding a disabled tool in the sidebar still leaves its URL reachable, so
     the route itself has to bounce. The server enforces this too — this is
     purely so a user does not land on a 503. */
  const toolForPath = PATH_TO_TOOL[location.pathname];
  const toolDisabled = toolForPath in features && features[toolForPath] === false;

  if (AUTH_PATHS.includes(location.pathname)) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
      </Routes>
    );
  }

  /* The admin dashboard has its own shell and token scope — it must not
     render inside the SinAi sidebar layout. */
  if (location.pathname.startsWith('/admin')) {
    return (
      <Routes>
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Overview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:userId" element={<UserDetail />} />
          <Route path="categories" element={<Categories />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="activity" element={<Activity />} />
          <Route path="research/playground" element={<SinLLamaPage />} />
          <Route path="research/summarizer-lab" element={<SummarizerPlayground />} />
          <Route path="research/comparison" element={<ModelComparison />} />
        </Route>
      </Routes>
    );
  }

  if (toolDisabled) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="relative h-full flex bg-canvas overflow-hidden">
      <Sidebar
        features={features}
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
            key={location.pathname}
            className={`mx-auto w-full ${MAX_WIDTHS[activeTool] ?? 'max-w-5xl'} px-4 sm:px-6 lg:px-8 py-6 lg:py-8
              animate-in fade-in slide-in-from-bottom-2 duration-300
              ${isChat ? 'flex-1 min-h-0 flex flex-col' : ''}`}
          >
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard onSelectTool={handleSelectTool} onQuickStart={handleQuickStart} />} />
              <Route path="/grammar" element={<ToolRunner activeTool="grammar" settings={effectiveSettings} setSettings={handleSettingsChange} />} />
              <Route path="/headlines" element={<ToolRunner activeTool="headlines" settings={effectiveSettings} setSettings={handleSettingsChange} />} />
              <Route path="/rewriter" element={<ToolRunner activeTool="rewriter" settings={effectiveSettings} setSettings={handleSettingsChange} />} />
              <Route path="/summarizer" element={<ToolRunner activeTool="summarizer" settings={effectiveSettings} setSettings={handleSettingsChange} />} />
              {/* Personal routes need a session; the four tools above stay open
                  to anonymous visitors, who simply do not get results saved. */}
              <Route path="/history" element={<ProtectedRoute><HistoryPage onSelectTool={handleSelectTool} onRerun={handleQuickStart} onBack={() => navigate('/dashboard')} /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage onBack={() => navigate('/dashboard')} onDefaultsChange={handleDefaultsChange} /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage onBack={() => navigate('/dashboard')} /></ProtectedRoute>} />
              <Route path="/plans" element={<ProtectedRoute><Plans /></ProtectedRoute>} />
              {/* The research tools moved to /admin/research/*. Send old
                  bookmarks to the dashboard rather than the admin route —
                  a non-admin would be redirected straight back out. */}
              <Route path="/sinllama" element={<Navigate to="/dashboard" replace />} />
              <Route path="/summarizer-playground" element={<Navigate to="/dashboard" replace />} />
              <Route path="/comparison" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
