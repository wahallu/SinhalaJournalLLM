import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { getMyUsage } from '../../services/api';
import { SkeletonLines } from '../ui/Skeleton';
import UsageHeatmap from './UsageHeatmap';

function StatTile({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4 dark:bg-ink-50">
      <p className="text-[11px] font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-[20px] font-bold leading-tight text-ink-900">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-ink-400">{sub}</p>}
    </div>
  );
}

/**
 * Usage tab: today's count against the plan limit, a 90-day activity
 * heatmap, and the two rollups (week total, active days) that make the
 * heatmap's shape legible as a number.
 *
 * Fetched once per mount rather than lifted into ProfilePage's shared state:
 * nothing else on the page needs it, and the other tabs would pay for a
 * fetch they never render.
 */
export default function UsagePanel() {
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getMyUsage()
      .then((data) => { if (active) setUsage(data); })
      .catch((err) => {
        if (!active) return;
        console.error('Could not load usage', err);
        setError(err.message);
      });
    return () => { active = false; };
  }, []);

  if (error) {
    return (
      <div className="p-5 sm:p-8">
        <div className="flex items-start gap-3 rounded-2xl border border-ink-200 bg-ink-50 p-4">
          <AlertCircle size={17} className="mt-0.5 shrink-0 text-ink-500" />
          <p className="text-[12.5px] leading-relaxed text-ink-600">
            Usage could not be loaded right now. Try again in a moment.
          </p>
        </div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="p-5 sm:p-8" role="status" aria-live="polite">
        <span className="sr-only">Loading usage</span>
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <SkeletonLines key={i} widths={[60, 40]} className="rounded-2xl border border-ink-200 p-4" />)}
        </div>
        <SkeletonLines widths={[100]} lineClassName="h-24" className="mt-4" />
      </div>
    );
  }

  const { today, week_requests: weekRequests, active_days: activeDays, series } = usage;
  const unlimited = !today || today.limit === null;

  return (
    <div className="space-y-5 p-5 sm:p-8">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Today"
          value={today ? `${today.used}${unlimited ? '' : ` / ${today.limit}`}` : '—'}
          sub={today ? `${today.plan_name} plan${unlimited ? ' · unlimited' : ''}` : 'No plan assigned yet'}
        />
        <StatTile label="This week" value={weekRequests} sub="requests, last 7 days" />
        <StatTile label="Active days" value={`${activeDays} / 7`} sub="days used this week" />
      </div>

      <section className="rounded-2xl border border-ink-200 p-5">
        <h3 className="mb-4 text-[13px] font-bold text-ink-900">
          Activity — last {series.length} days
        </h3>
        <UsageHeatmap series={series} />
      </section>
    </div>
  );
}
