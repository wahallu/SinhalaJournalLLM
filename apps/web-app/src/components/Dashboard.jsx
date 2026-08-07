import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight, ArrowUpRight, Activity, AlertTriangle, Clock, LogIn,
  History as HistoryIcon,
} from 'lucide-react';
import { Card } from './ui/Card';
import StatusBadge from './ui/StatusBadge';
import ActionButton from './ui/ActionButton';
import { ShinyButton } from './ui/shiny-button';
import Auralis from './ui/auralis';
import EmptyState from './ui/EmptyState';
import { OPTIMIZE_META, TOOL_LIST, TOOL_META } from '../lib/toolMeta';
import { useAuth } from '../auth/useAuth';
import { getCategories, getHistoryStats, getUnifiedHistory } from '../services/api';

/**
 * Greeting for the current hour in Sri Lanka, not in the reader's browser.
 *
 * The newsroom this serves works to Colombo time, so someone checking in
 * from another timezone should still see the greeting their desk would.
 * Asia/Colombo is UTC+5:30 year-round with no daylight saving, but the
 * offset is left to Intl rather than hardcoded.
 */
function greeting(now = new Date()) {
  let hour;
  try {
    hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Colombo',
        hour: 'numeric',
        hour12: false,
      }).format(now)
    );
  } catch {
    // Intl without full tz data (very old engines) — fall back to local.
    hour = now.getHours();
  }
  if (hour < 5) return 'Working late';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** How long each category sits before the next slides up. */
const ROTATE_MS = 3200;

/* Module-level, not inline: Auralis keys its WebGL setup on these, and a new
   array literal on every render would rebuild the shader program each time.
   The values are the brand ramp — brand-800 as the field, brand-600 and
   brand-400 as the two moving layers — so the hero animates within the same
   red the sidebar is painted in rather than introducing a second palette. */
const HERO_SHADER_COLORS = ['#cd191a', '#e97371'];
const HERO_SHADER_BASE = '#8d1213';

/**
 * The name after the greeting.
 *
 * Signed in, it is the person. Signed out there is no name to show, so the
 * admin-defined categories take the slot one at a time — "Good morning,
 * Journalist" then "Student" and so on — which doubles as a hint about who
 * the product is for. Falls back to a single neutral word if the category
 * list cannot be read, so the sentence is never left dangling.
 */
function RotatingName({ names }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (names.length < 2) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % names.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [names.length]);

  const current = names[index % names.length] ?? '';

  return (
    // Fixed height and clipped, so each word slides up out of a window
    // rather than nudging the heading's baseline as it changes.
    <span className="inline-block overflow-hidden align-bottom h-[1.15em]">
      <span key={current} className="inline-block animate-swipe-up">
        {current}
      </span>
    </span>
  );
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function StatCard({ label, value, hint, small = false, loading = false }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-[10.5px] font-bold text-ink-500 uppercase tracking-[0.12em]">{label}</p>
      {loading ? (
        // Shimmer rather than a zero. A tile that reads "0" while still
        // loading is a wrong answer, not a pending one.
        <>
          <div className="h-[22px] w-12 mt-1 rounded bg-ink-100 animate-shimmer" />
          <div className="h-[11px] w-20 mt-2 rounded bg-ink-100 animate-shimmer" />
        </>
      ) : (
        <>
          <p className={`font-bold text-ink-900 mt-1 leading-tight tabular-nums truncate ${small ? 'text-[15px] pt-1' : 'text-[22px]'}`}>
            {value}
          </p>
          {hint && <p className="text-[11px] text-ink-500 mt-1.5 truncate">{hint}</p>}
        </>
      )}
    </Card>
  );
}

export default function Dashboard({ onSelectTool, onQuickStart }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile } = useAuth();
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [categoryNames, setCategoryNames] = useState([]);
  // Bumped by the error state's retry, which re-runs the fetch effect.
  const [reloadKey, setReloadKey] = useState(0);
  // Primitive, not the object: a fresh `user` identity per render would make
  // the fetch effect loop. Combined with reloadKey so the retry button forces
  // a new request for the same user.
  const userId = user?.id ?? null;
  const requestKey = userId ? `${userId}:${reloadKey}` : null;
  const [loadedKey, setLoadedKey] = useState(null);

  /* Derived, not stored. Setting a loading flag inside the effect costs an
     extra render and leaves the first paint showing zeroes; comparing the
     request we want against the one we have is true from the very first
     render and flips to false only when that exact request has settled. */
  const loading = Boolean(requestKey) && loadedKey !== requestKey;

  // Only needed signed out, where they stand in for a name. The endpoint is
  // public for exactly this; a failure just leaves the fallback word.
  useEffect(() => {
    if (user) return undefined;
    let active = true;
    getCategories()
      .then((rows) => {
        if (active) setCategoryNames((rows ?? []).map((c) => c.name).filter(Boolean));
      })
      .catch(() => {
        if (active) setCategoryNames([]);
      });
    return () => {
      active = false;
    };
  }, [user]);

  // Prefer a real name, then the local part of the email, and only then a
  // generic word — "Good morning, nisal" beats "Good morning, Journalist"
  // for someone who has told us who they are.
  const signedInName =
    profile?.full_name?.trim() || user?.email?.split('@')[0] || 'Journalist';

  /* Both are per-user, so this re-runs whenever the signed-in identity
     changes. It used to run once on mount with an empty dependency list,
     which broke in both directions: signing in through the modal leaves the
     dashboard mounted, so the feed stayed empty until a manual reload, and
     signing out left the previous user's activity on screen.

     Stats come from their own endpoint rather than being counted off the
     history page — that page is capped at 50 rows, so every tile derived
     from it saturated there.

     Failure is tracked separately from emptiness. "No activity yet" and
     "we could not reach storage" look identical otherwise, and the backend
     answers the second with a 503 that says exactly that. */
  useEffect(() => {
    // Nothing to fetch signed out, and nothing to clear either: every panel
    // that could show another user's data branches on `user` before it reads
    // this state, so it is unreachable rather than stale.
    if (!requestKey) return undefined;

    let active = true;
    Promise.all([
      getUnifiedHistory(),
      getHistoryStats().catch(() => null),
    ])
      .then(([historyData, statsData]) => {
        if (!active) return;
        setHistory(
          (historyData.items ?? []).map((item) => ({
            id: item.id,
            tool: item.tool,
            input: item.input_preview ?? '',
            result: item.output_preview ?? '',
            timestamp: item.created_at,
          }))
        );
        setStats(statsData);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setHistory([]);
        setStats(null);
        setError(err?.message || 'Could not load your activity.');
      })
      .finally(() => {
        if (active) setLoadedKey(requestKey);
      });

    return () => {
      active = false;
    };
  }, [requestKey]);

  /* Server counts when they arrived, otherwise counted from the loaded feed.
     The fallback is capped at the page size and says so on the tile, which is
     honest about being approximate rather than quietly wrong — the previous
     behaviour presented the capped number as exact. */
  const derived = useMemo(() => {
    const counts = {};
    history.forEach((h) => { counts[h.tool] = (counts[h.tool] || 0) + 1; });
    return counts;
  }, [history]);

  const counts = stats?.per_tool ?? derived;
  const topToolKey = stats
    ? stats.top_tool
    : Object.entries(derived).sort((a, b) => b[1] - a[1])[0]?.[0];

  const recent = history.slice(0, 5);

  return (
    <div className="space-y-5">
      {/* ── Hero ── */}
      {/* surface-shell stays as the painted base. It is what the sidebar uses,
          so the two still match if the shader never draws — no WebGL, a lost
          context, a shader that fails to compile — and it is what shows for
          the frame before the canvas paints. */}
      <section className="surface-shell relative overflow-hidden rounded-2xl text-white px-6 py-8 sm:px-8 sm:py-9 shadow-pop">
        <Auralis
          className="absolute inset-0 z-0"
          colors={HERO_SHADER_COLORS}
          base={HERO_SHADER_BASE}
          speed={0.25}
          grain={0.32}
        />

        {/* Legibility scrim. The shader's light band drifts, so sooner or
            later a bright pass runs under the heading; without this the white
            text loses contrast for a few seconds every cycle. Weighted to the
            left, where the copy is, so the open right side keeps the effect. */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{ background: 'linear-gradient(90deg, rgba(74,12,14,0.62) 0%, rgba(74,12,14,0.28) 42%, transparent 72%)' }}
          aria-hidden="true"
        />

        {/* Legacy-encoded glyph — "is" is ASCII that only reads as Sinhala
            in UBIN16S, so the face has to be applied explicitly. */}
        <span
          className="font-legacy-sinhala pointer-events-none absolute -right-13 -bottom-44 z-[2]
            text-[29rem] leading-none font-regular text-white/[0.045] select-none"
          aria-hidden="true"
        >
          is
        </span>

        <div className="relative z-10 max-w-2xl">
          <h1 className="text-[1.75rem] sm:text-[2rem] font-bold tracking-tight leading-tight text-balance">
            {greeting()},{' '}
            {user ? signedInName : <RotatingName names={categoryNames.length ? categoryNames : ['Journalist']} />}
          </h1>
          <p className="text-[13.5px] text-white/70 mt-2 max-w-lg leading-relaxed">
            The first AI writing assistant built for Sinhala journalism
          </p>
          <div className="flex items-center mt-6">
            {/* Replaces "Start a grammar check": grammar is the first step of
                this run, so the shorter path is the better default. */}
            <ShinyButton
              id="dashboard-optimize"
              size="lg"
              icon={OPTIMIZE_META.icon}
              onClick={() => onSelectTool('optimize')}
            >
              {OPTIMIZE_META.label}
            </ShinyButton>
          </div>
        </div>
      </section>

      {/* ── Metrics ──
           Signed out, /history 401s and every tile can only ever read 0, so
           show an introduction instead of four zeroes. */}
      {user ? (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5" aria-label="Usage metrics">
          {/* On failure every tile reads "—/Unavailable" rather than a number.
              A zero here is a claim that the account has no work, which is the
              opposite of what an unreachable history store means — and it is
              the reading a user is most likely to panic about. */}
          <StatCard
            label="Total runs"
            loading={loading}
            value={error ? '—' : stats ? stats.total : history.length}
            hint={error ? 'Unavailable' : stats ? 'Across all tools' : 'Across all tools (recent)'}
          />
          <StatCard
            label="Today"
            loading={loading}
            value={!error && stats ? stats.today : '—'}
            hint={!error && stats ? 'Runs since midnight' : 'Unavailable'}
          />
          <StatCard
            label="This week"
            loading={loading}
            value={!error && stats ? stats.week : '—'}
            hint={!error && stats ? 'Last 7 days' : 'Unavailable'}
          />
          <StatCard
            label="Most used"
            loading={loading}
            small={!error && Boolean(topToolKey)}
            value={!error && topToolKey ? (TOOL_META[topToolKey]?.label ?? topToolKey) : '—'}
            hint={error ? 'Unavailable' : topToolKey ? 'Your go-to tool' : 'No runs yet'}
          />
        </section>
      ) : (
        <Card className="px-5 py-4 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="text-[13px] text-ink-700 font-medium">
            All four writing tools are free to use without an account.
          </p>
          <button
            onClick={() => navigate('/login', { state: { backgroundLocation: location } })}
            className="text-[13px] font-semibold text-brand-700 hover:underline cursor-pointer"
          >
            Sign in to save your work →
          </button>
        </Card>
      )}

      <div className="space-y-5">
          <section aria-label="Writing tools">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold text-ink-900 tracking-tight">Writing tools</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {TOOL_LIST.map(({ id, label, shortDesc, icon: Icon }) => (
                <Card
                  key={id}
                  hover
                  className="group text-left p-5 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  id={`dashboard-${id}`}
                  onClick={() => onSelectTool(id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectTool(id); } }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center shrink-0
                      transition-colors duration-200 group-hover:bg-brand-600">
                      <Icon size={18} className="text-brand-600 transition-colors duration-200 group-hover:text-white" strokeWidth={2} />
                    </div>
                    <ArrowUpRight size={16} className="text-ink-300 transition-all duration-200 group-hover:text-brand-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                  <h3 className="text-[14px] font-bold text-ink-900 mt-3.5">{label}</h3>
                  <p className="text-[12px] text-ink-500 mt-1 leading-relaxed">{shortDesc}</p>
                  {/* Signed out there is no per-user count to show, and "Not
                      used yet" would be a claim about a user we cannot see. */}
                  {user && (
                    <p className="text-[11px] text-ink-400 mt-3 tabular-nums">
                      {loading || error
                        ? ' '
                        : counts[id]
                          ? `${counts[id]} run${counts[id] !== 1 ? 's' : ''}`
                          : 'Not used yet'}
                    </p>
                  )}
                </Card>
              ))}
            </div>
          </section>

          {/* Recent activity */}
          <section aria-label="Recent activity">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-100">
                <div className="flex items-center gap-2">
                  <Activity size={14} className="text-brand-600" />
                  <h2 className="text-[13px] font-bold text-ink-900">Recent activity</h2>
                </div>
                {history.length > 0 && (
                  <button
                    onClick={() => onSelectTool('history')}
                    className="text-[11.5px] font-semibold text-ink-500 hover:text-brand-700 cursor-pointer
                      inline-flex items-center gap-1 transition-colors"
                  >
                    View all <ArrowRight size={12} />
                  </button>
                )}
              </div>

              {/* Four distinct states, in the order they can occur. Signed out
                  is first because it is not an error and not emptiness: work
                  is only ever saved against an account, so there is nothing to
                  load and nothing to fix. */}
              {!user ? (
                <EmptyState
                  icon={LogIn}
                  title="Sign in to see your activity"
                  description="Your runs are saved to your account. The writing tools work without one, but nothing is kept."
                  action={
                    <ActionButton
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate('/login', { state: { backgroundLocation: location } })}
                    >
                      Sign in
                    </ActionButton>
                  }
                />
              ) : loading ? (
                <ul className="divide-y divide-ink-100" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="flex items-center gap-3.5 px-5 py-3">
                      <div className="w-8 h-8 rounded-lg bg-ink-100 animate-shimmer shrink-0" />
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="h-[11px] w-24 rounded bg-ink-100 animate-shimmer" />
                        <div className="h-[13px] w-3/4 rounded bg-ink-100 animate-shimmer" />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : error ? (
                // Distinct from "no activity": the backend answers an
                // unreachable history store with a 503 saying so, and showing
                // that as emptiness tells the user their work is gone.
                <EmptyState
                  icon={AlertTriangle}
                  title="Couldn't load your activity"
                  description={error}
                  action={
                    <ActionButton size="sm" variant="secondary" onClick={() => setReloadKey((k) => k + 1)}>
                      Try again
                    </ActionButton>
                  }
                />
              ) : recent.length === 0 ? (
                <EmptyState
                  icon={HistoryIcon}
                  title="No activity yet"
                  description="Run any writing tool and your recent work will appear here."
                  action={
                    <ActionButton size="sm" variant="secondary" onClick={() => onSelectTool('grammar')}>
                      Run your first check
                    </ActionButton>
                  }
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {recent.map((item) => {
                    const meta = TOOL_META[item.tool];
                    const Icon = meta?.icon ?? Clock;
                    return (
                      <li key={item.id}>
                        <button
                          onClick={() => onQuickStart(item.tool, item.input)}
                          className="w-full flex items-center gap-3.5 px-5 py-3 text-left cursor-pointer
                            hover:bg-ink-50 transition-colors duration-150 group"
                          title="Reopen in tool"
                        >
                          <div className="w-8 h-8 rounded-lg bg-ink-100 text-ink-500 flex items-center justify-center shrink-0
                            group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-ink-500 uppercase tracking-wider">
                                {meta?.label ?? item.tool}
                              </span>
                              <span className="text-[11px] text-ink-400 shrink-0 tabular-nums">{timeAgo(item.timestamp)}</span>
                            </div>
                            <p className="text-[13px] text-ink-700 truncate mt-0.5">{item.input}</p>
                          </div>
                          <ArrowUpRight size={14} className="text-ink-300 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </section>
      </div>
    </div>
  );
}
