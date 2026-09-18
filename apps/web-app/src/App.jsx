import { useState, useCallback, useDeferredValue, useEffect, useMemo, lazy, Suspense } from 'react';
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
import RouteDialog from './components/RouteDialog';
import Dashboard from './components/Dashboard';
import { useToolProcessor } from './hooks/useToolProcessor';
import { usePlatformMeta } from './hooks/usePlatformMeta';
import { checkGrammar, generateHeadlines, hydrateHeadlineOutput, rewriteStyle, summarizeNews } from './services/api';
import ProtectedRoute from './auth/ProtectedRoute';
import { useAuth } from './auth/useAuth';
import { useLanguage } from './i18n/useLanguage.js';
import { T } from './i18n/T.jsx';
import { SEO_PAGES } from './seo/site';
import { usePageSeo } from './seo/usePageSeo';

import ErrorBoundary from './components/ErrorBoundary';
import RouteFallback from './components/ui/RouteFallback';

/* ── Lazily loaded routes ──
   The dashboard and the four writing tools stay eager: they are the first
   paint of nearly every session, so splitting them would trade a smaller
   bundle for a slower start on the common path.

   Everything below is off that path. The admin console alone is 14 pages
   plus recharts, and no ordinary visitor needs a byte of it. */
const AdminRoute         = lazy(() => import('./admin/AdminRoute'));
const AdminLayout        = lazy(() => import('./admin/AdminLayout'));
const Overview           = lazy(() => import('./admin/pages/Overview'));
const AdminUsers         = lazy(() => import('./admin/pages/Users'));
const UserDetail         = lazy(() => import('./admin/pages/UserDetail'));
const Chats              = lazy(() => import('./admin/pages/Chats'));
const Categories         = lazy(() => import('./admin/pages/Categories'));
const AdminPlans         = lazy(() => import('./admin/pages/Plans'));
const AdminUpgrades      = lazy(() => import('./admin/pages/Upgrades'));
const AdminSettings      = lazy(() => import('./admin/pages/Settings'));
const GrammarSettings    = lazy(() => import('./admin/pages/settings/GrammarSettings'));
const HeadlineSettings   = lazy(() => import('./admin/pages/settings/HeadlineSettings'));
const RewriterSettings   = lazy(() => import('./admin/pages/settings/RewriterSettings'));
const SummarizerSettings = lazy(() => import('./admin/pages/settings/SummarizerSettings'));
const Activity           = lazy(() => import('./admin/pages/Activity'));
const SinLLamaPage       = lazy(() => import('./admin/research/SinLLamaPage'));
const ModelComparison    = lazy(() => import('./admin/research/ModelComparison'));

/* The auth dialogs open over a page on demand, never as the first paint of
   a visit, so they are split out too. Their routes already sit inside a
   Suspense boundary. */
const Login          = lazy(() => import('./pages/auth/Login'));
const Signup         = lazy(() => import('./pages/auth/Signup'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const ResetPassword  = lazy(() => import('./pages/auth/ResetPassword'));
const VerifyEmail    = lazy(() => import('./pages/auth/VerifyEmail'));

const OptimizePage   = lazy(() => import('./components/optimize/OptimizePage'));
const HistoryPage    = lazy(() => import('./components/HistoryPage'));
const ProfilePage    = lazy(() => import('./components/ProfilePage'));
const Plans          = lazy(() => import('./components/Plans'));
const Onboarding     = lazy(() => import('./components/onboarding/Onboarding'));
const SeoLandingPage = lazy(() => import('./components/seo/SeoLandingPage'));


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
    titleKey: 'nav.grammar',
    actionKey: 'tool.correct',
    placeholder: "fuys Tnf.a isxy, jdlHh we;=<;a lrkak'''",
    outputType: 'text',
    icon: TOOL_META.grammar.icon,
    helper: 'Paste or type Sinhala text to check grammar',
  },
  headlines: {
    titleKey: 'nav.headlines',
    actionKey: 'tool.generate',
    placeholder: "fuys m%jD;a;s ,smsh we;=<;a lrkak'''",
    outputType: 'headlines',
    icon: TOOL_META.headlines.icon,
    helper: 'Paste the full article to generate headlines',
  },
  rewriter: {
    titleKey: 'nav.rewriter',
    actionKey: 'tool.rewrite',
    placeholder: "kej; ,sùug wjYH ,smsh we;=<;a lrkak'''",
    outputType: 'text',
    icon: TOOL_META.rewriter.icon,
    helper: 'Paste text to rewrite in a different tone',
  },
  summarizer: {
    titleKey: 'nav.summarizer',
    actionKey: 'tool.summarize',
    placeholder: "idrdxY lsÍug wjYH ,smsh we;=<;a lrkak'''",
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
    // preference — they are per-article decisions with no settings surface
    // of their own to live in.
    optimizeRestyle: false,
    optimizeSummarize: false,
  };
}

function ToolRunner({ activeTool, settings, setSettings }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tu } = useLanguage();
  const config = TOOL_CONFIG[activeTool];
  const { input, setInput, output, loading, error, process, clear, restore } = useToolProcessor();
  // The output panels read the editor text, so every keystroke re-rendered
  // them — the grammar diff and the headline panel are the heaviest trees on
  // the page. They get a deferred copy instead: typing commits first, and
  // the (memoised) panels catch up at low priority once the input settles.
  const deferredInput = useDeferredValue(input);

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

  const resultsTitle = tu(activeTool === 'headlines' ? 'tool.generatedHeadlines' : 'tool.result');
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
          <T k="tool.apply" />
        </ActionButton>
      )}
    </>
  );

  return (
    <div className="tool-workspace">
      <div className="tw-editor flex flex-col">
          <Editor
            tool={activeTool}
            title={tu(config.titleKey)}
            icon={config.icon}
            placeholder={config.placeholder}
            actionLabel={tu(config.actionKey)}
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
              articleText={deferredInput}
            />
          ) : (
            <OutputPanel
              output={output}
              loading={loading}
              error={error}
              type={config.outputType}
              activeTool={activeTool}
              input={deferredInput}
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
                <T k="tool.signInToSave" />
              </span>
              <button
                onClick={() => navigate('/login', { state: { backgroundLocation: location } })}
                className="text-[12.5px] font-semibold text-brand-700 hover:underline cursor-pointer"
              >
                <T k="nav.signIn" />
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


  if (seoLandingPage) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <SeoLandingPage page={seoLandingPage} />
        </Suspense>
      </ErrorBoundary>
    );
  }

  const isEditor = EDITOR_TOOLS.includes(activeTool);

  /* Hiding a disabled tool in the sidebar still leaves its URL reachable, so
     the route itself has to bounce. The server enforces this too — this is
     purely so a user does not land on a 503. */
  const toolForPath = PATH_TO_TOOL[backgroundLocation.pathname];
  const toolDisabled = toolForPath in features && features[toolForPath] === false;

  if (authLoading) {
    return (
      <div
        className="h-full bg-canvas flex items-center justify-center"
        role="status"
        aria-live="polite"
      >
        <span className="sr-only">Loading your workspace</span>
        {/* Same mark and same motion as the index.html splash, so resolving
            the session after it clears reads as one continuous state rather
            than two different loaders. */}
        <img src="/logored.svg" alt="" className="w-14 h-14 object-contain animate-splash-pulse" />
      </div>
    );
  }

  /* The admin dashboard has its own shell and token scope — it must not
     render inside the SinAi sidebar layout. */
  if (location.pathname.startsWith('/admin')) {
    return (
      <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
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
          <Route path="plans" element={<AdminPlans />} />
          <Route path="upgrades" element={<AdminUpgrades />} />
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
      </Suspense>
      </ErrorBoundary>
    );
  }

  if (user && !user.onboarding_completed_at) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Onboarding user={user} onComplete={updateAccount} />
        </Suspense>
      </ErrorBoundary>
    );
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
        theme={theme}
        onThemeChange={handleThemeChange}
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
            <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
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
              {/* Public: a pricing page behind a login wall cannot do its
                  job, and the catalog is marketing copy rather than anyone's
                  data. Signed-in extras (current-tier badge, today's usage)
                  come from /plans/me, which does require a session. */}
              <Route path="/plans" element={<Plans />} />

              {/* The research tools moved to /admin/research/*. Send old
                  bookmarks to the dashboard rather than the admin route —
                  a non-admin would be redirected straight back out. */}
              <Route path="/sinllama" element={<Navigate to="/dashboard" replace />} />
              <Route path="/summarizer-playground" element={<Navigate to="/dashboard" replace />} />
              <Route path="/comparison" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            </Suspense>
            </ErrorBoundary>
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
      <ErrorBoundary>
      <Suspense fallback={null}>
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
                size="profile"
                showHeader={false}
                closePlacement="start"
              >
                <ProfilePage variant="dialog" />
              </RouteDialog>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={null} />
      </Routes>
      </Suspense>
      </ErrorBoundary>
    </div>
  );
}

export default App;
