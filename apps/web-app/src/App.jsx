import { useState, useCallback, useEffect, useMemo } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Menu, ArrowDownToLine } from 'lucide-react';
import Sidebar from './components/Sidebar';
import { TOOL_META } from './lib/toolMeta';
import { SUMMARY_VIEWS, DEFAULT_HEADLINE_MODEL } from './lib/toolOptions';
import ActionButton from './components/ui/ActionButton';
import Dropdown from './components/ui/Dropdown';
import Editor from './components/editor/Editor';
import ResultsPane from './components/editor/ResultsPane';
import OutputPanel from './components/OutputPanel';
import HeadlineOutputPanel from './components/HeadlineOutputPanel';
import OptimizePage from './components/optimize/OptimizePage';
import RouteDialog from './components/RouteDialog';
import Dashboard from './components/Dashboard';
import HistoryPage from './components/HistoryPage';
import SettingsPage from './components/SettingsPage';
import ProfilePage from './components/ProfilePage';
import Plans from './components/Plans';
import { useToolProcessor } from './hooks/useToolProcessor';
import { usePlatformMeta } from './hooks/usePlatformMeta';
import { checkGrammar, generateHeadlines, hydrateHeadlineOutput, rewriteStyle, summarizeNews } from './services/api';
import ProtectedRoute from './auth/ProtectedRoute';
import { useAuth } from './auth/useAuth';
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
import Chats from './admin/pages/Chats';
import Categories from './admin/pages/Categories';
import AdminSettings from './admin/pages/Settings';
import GrammarSettings from './admin/pages/settings/GrammarSettings';
import HeadlineSettings from './admin/pages/settings/HeadlineSettings';
import RewriterSettings from './admin/pages/settings/RewriterSettings';
import SummarizerSettings from './admin/pages/settings/SummarizerSettings';
import Activity from './admin/pages/Activity';
import SinLLamaPage from './admin/research/SinLLamaPage';
import ModelComparison from './admin/research/ModelComparison';
import Onboarding from './components/onboarding/Onboarding';
import SeoLandingPage from './components/seo/SeoLandingPage';
import { SEO_PAGES } from './seo/site';
import { usePageSeo } from './seo/usePageSeo';

/* Routes that render as a dialog over whatever page is behind them, rather
   than as a page of their own. In-app navigation to one of these carries the
   current location forward as backgroundLocation, so that page keeps
   rendering underneath; reached directly — an email link, a pasted URL —
   there is no such page, so the shell falls back to the dashboard instead. */
const MODAL_PATHS = [
  '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/profile',
];

/* Placeholders are written in the legacy ubin16s encoding (see index.css).
   Punctuation is remapped along with everything else: "." draws ග and "¡"
   draws a ligature, so a trailing ellipsis has to be spelled "'''" — the
   apostrophe is the slot holding the full stop in that face. */
const TOOL_CONFIG = {
  grammar: {
    title: TOOL_META.grammar.label,
    placeholder: "fuys Tnf.a isxy, jdlHh we;=<;a lrkak'''",
    actionLabel: 'Correct',
    outputType: 'text',
    icon: TOOL_META.grammar.icon,
    helper: 'Paste or type Sinhala text to check grammar',
  },
  headlines: {
    title: TOOL_META.headlines.label,
    placeholder: "fuys m%jD;a;s ,smsh we;=<;a lrkak'''",
    actionLabel: 'Generate',
    outputType: 'headlines',
    icon: TOOL_META.headlines.icon,
    helper: 'Paste the full article to generate headlines',
  },
  rewriter: {
    title: TOOL_META.rewriter.label,
    placeholder: "kej; ,sùug wjYH ,smsh we;=<;a lrkak'''",
    actionLabel: 'Rewrite',
    outputType: 'text',
    icon: TOOL_META.rewriter.icon,
    helper: 'Paste text to rewrite in a different tone',
  },
  summarizer: {
    title: TOOL_META.summarizer.label,
    placeholder: "idrdxY lsÍug wjYH ,smsh we;=<;a lrkak'''",
    actionLabel: 'Summarize',
    outputType: 'text',
    icon: TOOL_META.summarizer.icon,
    helper: 'Paste the article to summarize',
  },
};

const PATH_TO_TOOL = {
  '/optimize': 'optimize',
  '/grammar': 'grammar',
  '/headlines': 'headlines',
  '/rewriter': 'rewriter',
  '/summarizer': 'summarizer',
  '/history': 'history',
  '/settings': 'settings',
  '/plans': 'plans',
  '/dashboard': 'dashboard',
};

const TOOL_TO_PATH = {
  optimize: '/optimize',
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

/* The writing tools render the two-pane editor workspace, which is
   full-height with independently scrolling panes at xl and stacks below. */
const EDITOR_TOOLS = ['optimize', 'grammar', 'headlines', 'rewriter', 'summarizer'];

const MAX_WIDTHS = {
  dashboard: 'max-w-7xl',
  optimize: 'max-w-[1600px]',
  grammar: 'max-w-[1600px]',
  headlines: 'max-w-[1600px]',
  rewriter: 'max-w-[1600px]',
  summarizer: 'max-w-[1600px]',
  history: 'max-w-4xl',
  settings: 'max-w-3xl',
  profile: 'max-w-3xl',
  plans: 'max-w-6xl',
};

const USER_THEME_KEY = 'sinai_theme';

function getUserTheme(userId) {
  if (!userId) return 'light';
  return localStorage.getItem(`${USER_THEME_KEY}:${userId}`) === 'dark' ? 'dark' : 'light';
}

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
    category: 'General',
    headlineLength: 'medium',
    headlineModel: DEFAULT_HEADLINE_MODEL,
    summaryView: 'paragraph',
    // Optimize's two opt-in stages. Session state rather than a stored
    // preference — they are per-article decisions, and SettingsPage does not
    // offer them.
    optimizeRestyle: false,
    optimizeSummarize: false,
  };
}

function ToolRunner({ activeTool, settings, setSettings }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const config = TOOL_CONFIG[activeTool];
  const { input, setInput, output, loading, error, process, clear, restore } = useToolProcessor();

  useEffect(() => {
    const historyRun = location.state?.historyRun;
    if (historyRun) {
      const restoredOutput = activeTool === 'headlines'
        ? hydrateHeadlineOutput(historyRun.output || {}, historyRun.settings?.headlineLength)
        : historyRun.output;
      restore(historyRun.input, restoredOutput);
      if (historyRun.settings && Object.keys(historyRun.settings).length) {
        setSettings({ ...settings, ...historyRun.settings });
      }
      navigate(location.pathname, { replace: true, state: null });
    } else if (location.state?.text) {
      restore(location.state.text, null);
      navigate(location.pathname, { replace: true, state: null });
    }
    // A navigation state is consumed once. Depending on the whole settings
    // object here would replay restoration after the merge it triggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, activeTool, location.pathname, navigate, restore]);

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
            length: settings.headlineLength,
            numCandidates: settings.count,
            category: settings.category || 'General',
            adapter: settings.headlineModel,
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

  // Matches OutputPanel's own resolution order. Headlines are excluded from
  // Apply: a headline is not a replacement for the article it came from.
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
        <ActionButton
          size="sm"
          variant="ghost"
          icon={ArrowDownToLine}
          onClick={() => setInput(resultText)}
          title="Replace the editor content with this result"
        >
          Apply
        </ActionButton>
      )}
    </>
  );

  return (
    <div className="tool-workspace">
      <div className="tw-editor flex flex-col">
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
            hasResult={Boolean(output)}
            settings={settings}
            onSettingsChange={setSettings}
          />
        </div>

      <div className="tw-results flex flex-col">
        <ResultsPane title={resultsTitle} right={resultsControls}>
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
              showCorrections={activeTool === 'grammar'}
            />
          )}

          {/* Offered once the result exists — the moment saving is actually
              worth something — rather than gating the tool up front. */}
          {!user && output && !loading && (
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3
              rounded-xl bg-ink-50 border border-ink-200/70">
              <span className="text-[12.5px] text-ink-600">
                Sign in to save this to your history.
              </span>
              <button
                onClick={() => navigate('/login', { state: { backgroundLocation: location } })}
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

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  usePageSeo();
  const { user, loading: authLoading, updateAccount } = useAuth();
  const userId = user?.id;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settings, setSettings] = useState(loadDefaultSettings);
  const [themeOverride, setThemeOverride] = useState({ userId: null, theme: 'light' });
  const { features, defaults: globalDefaults } = usePlatformMeta();
  const previewTheme = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('__previewTheme')
    : null;
  const seoLandingPage = location.pathname === '/' ? null : SEO_PAGES[location.pathname];

  // Theme preferences are intentionally account-scoped. This keeps users on
  // a shared browser from inheriting one another's choice while preserving a
  // user's selection across refreshes and sign-ins on this device.
  const theme = previewTheme === 'dark'
    ? 'dark'
    : (themeOverride.userId === userId ? themeOverride.theme : getUserTheme(userId));

  // The user-facing app and admin console have separate appearance controls.
  // Applying the class to <html> also themes portalled dialogs, while removing
  // it on /admin prevents the user preference from overriding AdminLayout.
  useEffect(() => {
    const dark = theme === 'dark' && !location.pathname.startsWith('/admin');
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';

    const themeColor = document.querySelector('meta[name="theme-color"]');
    themeColor?.setAttribute('content', dark ? '#161112' : '#f5f4f4');
  }, [theme, location.pathname]);

  const handleThemeChange = useCallback((nextTheme) => {
    const resolved = nextTheme === 'dark' ? 'dark' : 'light';
    setThemeOverride({ userId, theme: resolved });
    if (userId) {
      localStorage.setItem(`${USER_THEME_KEY}:${userId}`, resolved);
    }
  }, [userId]);

  // Precedence: the user's own choice, then the admin's global default, then
  // a hardcoded fallback. Derived rather than synced into state, so a change
  // on either side is reflected without an effect writing back.
  const effectiveSettings = useMemo(() => ({
    ...settings,
    tone: settings.tone ?? globalDefaults?.tone ?? 'formal',
    length: settings.length ?? globalDefaults?.length ?? 'short',
    count: settings.count ?? globalDefaults?.headline_count ?? 3,
  }), [settings, globalDefaults]);

  // The page a modal route renders over — see MODAL_PATHS above.
  // Only overridden on a modal path itself — otherwise a non-modal route
  // like /history would inherit whatever backgroundLocation state it was
  // navigated with and skip rendering (and, for a protected route, skip its
  // own auth check) in favor of that background page.
  const backgroundLocation = MODAL_PATHS.includes(location.pathname)
    ? (location.state?.backgroundLocation ?? { pathname: '/dashboard' })
    : location;

  const activeTool = PATH_TO_TOOL[backgroundLocation.pathname] || 'dashboard';

  const handleSelectTool = useCallback((toolId) => {
    const path = TOOL_TO_PATH[toolId] || `/${toolId}`;
    // Carried forward unconditionally: harmless where nothing reads it, and
    // it is what lets a protected route (history, settings, plans) hand a
    // real backdrop to /login if ProtectedRoute ends up redirecting there.
    navigate(path, { state: { backgroundLocation: location } });
  }, [navigate, location]);

  const handleQuickStart = useCallback((toolId, payload = '') => {
    const path = TOOL_TO_PATH[toolId] || `/${toolId}`;
    const state = typeof payload === 'object' && payload !== null
      ? { historyRun: payload }
      : { text: payload };
    navigate(path, { state });
  }, [navigate]);

  /* The dashboard is both its own route and the backdrop every modal route
     renders over, so it is built once here rather than repeated seven times
     in the route table. */
  const dashboard = (
    <Dashboard onSelectTool={handleSelectTool} onQuickStart={handleQuickStart} />
  );

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

  if (seoLandingPage) {
    return <SeoLandingPage page={seoLandingPage} />;
  }

  const isEditor = EDITOR_TOOLS.includes(activeTool);

  /* Hiding a disabled tool in the sidebar still leaves its URL reachable, so
     the route itself has to bounce. The server enforces this too — this is
     purely so a user does not land on a 503. */
  const toolForPath = PATH_TO_TOOL[backgroundLocation.pathname];
  const toolDisabled = toolForPath in features && features[toolForPath] === false;

  if (authLoading) {
    return <div className="h-full bg-white" aria-label="Loading your workspace" />;
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
          <Route path="chats" element={<Chats />} />
          <Route path="categories" element={<Categories />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="settings/grammar" element={<GrammarSettings />} />
          <Route path="settings/headlines" element={<HeadlineSettings />} />
          <Route path="settings/rewriter" element={<RewriterSettings />} />
          <Route path="settings/summarizer" element={<SummarizerSettings />} />
          <Route path="activity" element={<Activity />} />
          <Route path="research/playground" element={<SinLLamaPage />} />
          <Route path="research/summarizer-lab" element={<Navigate to="/admin/research/comparison" replace />} />
          <Route path="research/comparison" element={<ModelComparison />} />
        </Route>
      </Routes>
    );
  }

  if (user && !user.onboarding_completed_at) {
    return <Onboarding user={user} onComplete={updateAccount} />;
  }

  if (toolDisabled) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="relative h-full flex bg-canvas overflow-hidden animate-in fade-in duration-500">
      <Sidebar
        features={features}
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((v) => !v)}
        collapsed={sidebarCollapsed}
        onCollapse={() => setSidebarCollapsed((v) => !v)}
      />

      {/* No spacer div here any more. The sidebar is an in-flow flex child
          from lg upward (see Sidebar.jsx), so it reserves its own column and
          nothing has to repeat its width to keep the content clear of it. */}

      <div className="flex-1 min-w-0 h-full flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 h-14 shrink-0 flex items-center gap-3 px-4
          bg-white/85 dark:bg-ink-50/90 backdrop-blur border-b border-ink-200/70">
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

        <main className={`flex-1 min-h-0 overflow-y-auto ${isEditor ? 'xl:overflow-hidden xl:flex xl:flex-col' : ''}`}>
          <div
            key={backgroundLocation.pathname}
            className={`mx-auto w-full ${MAX_WIDTHS[activeTool] ?? 'max-w-5xl'} px-4 sm:px-6 lg:px-8 py-6 lg:py-8
              animate-in fade-in slide-in-from-bottom-2 duration-300
              ${isEditor ? 'xl:flex-1 xl:min-h-0 xl:flex xl:flex-col' : ''}`}
          >
            <Routes location={backgroundLocation}>
              <Route path="/" element={dashboard} />
              <Route path="/dashboard" element={dashboard} />
              <Route path="/optimize" element={<OptimizePage settings={effectiveSettings} setSettings={handleSettingsChange} />} />
              <Route path="/grammar" element={<ToolRunner activeTool="grammar" settings={effectiveSettings} setSettings={handleSettingsChange} />} />
              <Route path="/headlines" element={<ToolRunner activeTool="headlines" settings={effectiveSettings} setSettings={handleSettingsChange} />} />
              <Route path="/rewriter" element={<ToolRunner activeTool="rewriter" settings={effectiveSettings} setSettings={handleSettingsChange} />} />
              <Route path="/summarizer" element={<ToolRunner activeTool="summarizer" settings={effectiveSettings} setSettings={handleSettingsChange} />} />
              {/* Personal routes need a session; the four tools above stay open
                  to anonymous visitors, who simply do not get results saved. */}
              <Route path="/history" element={<ProtectedRoute><HistoryPage onSelectTool={handleSelectTool} onRerun={handleQuickStart} onBack={() => navigate('/dashboard')} /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage onBack={() => navigate('/dashboard')} onDefaultsChange={handleDefaultsChange} theme={theme} onThemeChange={handleThemeChange} /></ProtectedRoute>} />
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

      {/* ── Modal routes ──
          Auth and profile keep real URLs — they are linked from emails and
          from several places in the app — but render as a dialog over
          whatever page is behind them. Matched against the real location
          (not backgroundLocation), so the dialog opens and closes as the URL
          changes; the page underneath is whichever route backgroundLocation
          resolved to above. Both dialogs are portalled to the body regardless
          of where in the tree they render. */}
      <Routes location={location}>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <RouteDialog
                title="Profile"
                description="Your identity and newsroom preferences."
                size="xl"
                showHeader={false}
                inverseClose
              >
                <ProfilePage variant="dialog" />
              </RouteDialog>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={null} />
      </Routes>
    </div>
  );
}

export default App;
