import { useEffect, useState } from 'react';
import { Check, Sparkles, Zap, Shield, Layers } from 'lucide-react';
import { Card } from './ui/Card';
import { SkeletonLines } from './ui/Skeleton';
import { getPlans, getMyPlan } from '../services/api';
import { useAuth } from '../auth/useAuth';

/**
 * Plan catalog.
 *
 * Tiers, copy, features and limits are admin-owned data served by
 * GET /api/v1/plans — they used to be a hardcoded PLANS array here, which
 * meant changing a price bullet required a frontend deploy.
 *
 * Still no prices and no working upgrade button: there is no billing
 * integration behind them, and quoting a monthly figure against an action
 * that does nothing misrepresents the product. That reasoning is unchanged
 * from before this page was made dynamic.
 */

/* An admin can create any slug, so this is a lookup with a neutral fallback
   rather than an exhaustive map. */
const PLAN_ICONS = { free: Shield, plus: Zap, pro: Sparkles };

function iconFor(slug) {
  return PLAN_ICONS[slug] ?? Layers;
}

function UsageBar({ quota }) {
  if (!quota || quota.limit === null) return null;
  const pct = Math.min(100, Math.round((quota.used / quota.limit) * 100));
  const spent = quota.used >= quota.limit;
  return (
    <div className="w-full max-w-md mt-6 text-left">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[12px] font-semibold text-ink-700">
          {quota.used} of {quota.limit} requests today
        </span>
        <span className="text-[11.5px] text-ink-400">
          Resets {new Date(quota.resets_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-ink-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${spent ? 'bg-brand-600' : 'bg-ink-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Plans() {
  const { user } = useAuth();
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState('');

  /* Keyed by account, the same shape App.jsx uses for the theme override.
     Storing the owner alongside the value means signing out — or switching
     accounts on a shared browser — shows nothing rather than briefly showing
     the previous user's usage while the next fetch is in flight. */
  const [quotaFor, setQuotaFor] = useState({ userId: null, quota: null });
  const mine = quotaFor.userId === (user?.id ?? null) ? quotaFor.quota : null;

  useEffect(() => {
    let active = true;
    getPlans()
      .then((data) => { if (active) setPlans(data ?? []); })
      .catch((err) => {
        if (!active) return;
        console.error('Could not load the plan catalog', err);
        setPlans([]);
        setError(err.message);
      });
    return () => { active = false; };
  }, []);

  // Separate from the catalog so a signed-out visitor still gets the page,
  // and so a quota read failing never blanks the tiers.
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return undefined;
    let active = true;
    getMyPlan()
      .then((data) => { if (active) setQuotaFor({ userId, quota: data }); })
      .catch(() => { if (active) setQuotaFor({ userId, quota: null }); });
    return () => { active = false; };
  }, [user]);

  return (
    <div className="w-full flex flex-col items-center pt-2 pb-10">
      <div className="text-center mb-9 max-w-xl">
        <h1 className="text-[1.6rem] font-bold text-ink-900 tracking-tight mb-2 text-balance">
          Upgrade your workflow
        </h1>
        <p className="text-[13.5px] text-ink-500 leading-relaxed">
          Where SinAi is heading for newsrooms writing, editing, and publishing in Sinhala.
        </p>
        <p className="text-[12.5px] text-ink-400 mt-3">
          Paid plans are not available yet — every tool is currently free to use.
        </p>
        <div className="flex justify-center">
          <UsageBar quota={mine} />
        </div>
      </div>

      {plans === null && (
        <div className="w-full max-w-5xl" role="status" aria-live="polite">
          <span className="sr-only">Loading plans</span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <Card key={i} className="p-6">
                <SkeletonLines widths={[40, 90, 70, 100, 85, 60]} />
              </Card>
            ))}
          </div>
        </div>
      )}

      {plans !== null && plans.length === 0 && (
        <div className="text-center max-w-sm">
          {/* The API's own message is kept out of this copy on purpose: a
              user reading "Not Found" learns nothing, and the reason is
              always something only an operator can act on. It goes to the
              console instead, where it is useful. */}
          <p className="text-[13px] text-ink-500">
            {error
              ? 'Plans could not be loaded right now. Every tool is still free to use.'
              : 'No plans are available right now.'}
          </p>
        </div>
      )}

      {plans !== null && plans.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-5xl items-stretch">
          {plans.map((plan) => {
            const Icon = iconFor(plan.slug);
            const isCurrentPlan = mine?.plan_slug === plan.slug;
            const isFeatured = Boolean(plan.badge);

            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col p-6 transition-all duration-200
                  ${isFeatured
                    ? 'border-brand-300 shadow-card-hover'
                    : 'hover:border-ink-300 hover:shadow-card-hover'}`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-6 bg-brand-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider shadow-sm">
                    {plan.badge}
                  </span>
                )}

                <div className="mb-5">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4
                    ${isFeatured ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/25' : 'bg-ink-100 text-ink-600'}`}>
                    <Icon size={18} strokeWidth={2.25} />
                  </div>
                  <h2 className="text-[16px] font-bold text-ink-900 mb-1">{plan.name}</h2>
                  <p className="text-[12.5px] text-ink-500 leading-relaxed min-h-10">{plan.description}</p>
                </div>

                <button
                  className={`w-full py-2.5 px-5 rounded-xl font-semibold text-[13.5px] mb-6 cursor-not-allowed
                    ${isCurrentPlan
                      ? 'bg-ink-100 text-ink-500'
                      : 'bg-ink-50 text-ink-400 border border-ink-200'}`}
                  disabled
                >
                  {isCurrentPlan ? 'Current plan' : 'Coming soon'}
                </button>

                <div className="flex-1">
                  <p className="text-[10.5px] font-bold text-ink-500 mb-3.5 uppercase tracking-[0.14em]">Includes</p>
                  <ul className="space-y-3">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <span className={`mt-0.5 w-4.5 h-4.5 rounded-full flex items-center justify-center shrink-0
                          ${isFeatured ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-600'}`}>
                          <Check size={10} strokeWidth={3} />
                        </span>
                        <span className="text-[13px] text-ink-700 font-medium leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {plan.limits?.requests_per_day != null && (
                    <p className="mt-4 pt-4 border-t border-ink-200/70 text-[11.5px] text-ink-500">
                      {plan.limits.requests_per_day} requests per day
                    </p>
                  )}
                  {plan.limits && plan.limits.requests_per_day == null && (
                    <p className="mt-4 pt-4 border-t border-ink-200/70 text-[11.5px] text-ink-500">
                      Unlimited daily requests
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
