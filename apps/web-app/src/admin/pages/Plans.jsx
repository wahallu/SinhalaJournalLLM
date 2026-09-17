import { useEffect, useState } from 'react';
import { Archive, Pencil, Plus, Star } from 'lucide-react';
import { archivePlan, createPlan, listPlans, updatePlan } from '../adminApi';
import ConfirmDialog from '../ConfirmDialog';
import { formatPrice } from '../../lib/money.js';

/**
 * Plan catalog management.
 *
 * Tiers, copy, feature bullets and quota limits used to be a hardcoded array
 * in components/Plans.jsx, so changing any of them needed a frontend deploy.
 * They are data now, and this is where an admin edits them.
 *
 * `limits` is the part with teeth — requests_per_day is enforced on every
 * signed-in request. The server validates the shape strictly, so a typo comes
 * back as a 422 rather than silently disabling the cap.
 */

const INPUT = `w-full px-3 py-2 text-[13px] rounded-md border bg-background text-foreground
  placeholder:text-muted-foreground focus:outline-none focus:ring-2`;

const BILLING_PERIODS = [
  { value: 'monthly', label: '/month' },
  { value: 'yearly',  label: '/year' },
  { value: 'one_off', label: 'one-off' },
];

const BLANK = {
  slug: '', name: '', description: '', badge: '',
  featuresText: '', requestsPerDay: '', sortOrder: 0, isVisible: true, isDefault: false,
  ctaLabel: '', ctaHref: '',
  priceCents: '', annualPriceCents: '', currency: 'LKR', billingPeriod: 'monthly',
};

/** Mirrors the API's ^[a-z0-9-]{1,40}$ so the problem shows before submitting. */
const SLUG_PATTERN = /^[a-z0-9-]{1,40}$/;

function toForm(plan) {
  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    description: plan.description ?? '',
    badge: plan.badge ?? '',
    featuresText: (plan.features ?? []).join('\n'),
    // An empty field means "no cap", which the server stores as null.
    requestsPerDay: plan.limits?.requests_per_day ?? '',
    sortOrder: plan.sort_order ?? 0,
    isVisible: plan.is_visible !== false,
    isDefault: Boolean(plan.is_default),
    ctaLabel: plan.cta_label ?? '',
    ctaHref: plan.cta_href ?? '',
    // Empty string means "no price shown" — stored as null on the server.
    priceCents: plan.price_cents != null ? String(plan.price_cents) : '',
    annualPriceCents: plan.annual_price_cents != null ? String(plan.annual_price_cents) : '',
    currency: plan.currency ?? 'LKR',
    billingPeriod: plan.billing_period ?? 'monthly',
  };
}

export default function Plans() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const [pendingArchive, setPendingArchive] = useState(null);
  const [dialogError, setDialogError] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Mutations bump this to trigger a refetch rather than calling a shared
  // loader from the effect body — same reason as Categories.jsx.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listPlans();
        if (!active) return;
        setRows(data);
        setError(null);
      } catch (e) {
        if (active) setError(e.message);
      }
    })();
    return () => { active = false; };
  }, [refreshKey]);

  const slugInvalid = form && form.slug && !SLUG_PATTERN.test(form.slug);

  const save = async (e) => {
    e.preventDefault();
    if (slugInvalid) return;
    setBusy(true);
    setError(null);
    try {
      const limits = {};
      if (String(form.requestsPerDay).trim() !== '') {
        limits.requests_per_day = Number(form.requestsPerDay);
      }

      // Empty price means "no price shown" (free / unpriced tier).
      // The server stores null, which also suppresses the Upgrade button.
      const priceCentsRaw = String(form.priceCents).trim();
      const annualPriceCentsRaw = String(form.annualPriceCents).trim();

      const payload = {
        name: form.name,
        description: form.description,
        badge: form.badge || null,
        features: form.featuresText.split('\n').map((f) => f.trim()).filter(Boolean),
        limits,
        sort_order: Number(form.sortOrder) || 0,
        is_visible: form.isVisible,
        is_default: form.isDefault,
        // Empty means "no button on the card" — the server turns blank into
        // null, and both being null is what suppresses it.
        cta_label: form.ctaLabel.trim() || null,
        cta_href: form.ctaHref.trim() || null,
        // Pricing — null hides the price block and disables the Upgrade button.
        price_cents: priceCentsRaw !== '' ? Number(priceCentsRaw) : null,
        annual_price_cents: annualPriceCentsRaw !== '' ? Number(annualPriceCentsRaw) : null,
        currency: form.currency,
        billing_period: form.billingPeriod,
      };

      if (form.id) {
        // Never PATCH is_default:false — the server refuses clearing the only
        // default, and an edit to an unrelated field should not attempt it.
        if (!form.isDefault) delete payload.is_default;
        await updatePlan(form.id, payload);
      } else {
        await createPlan({ ...payload, slug: form.slug });
      }
      setForm(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (plan) => {
    setError(null);
    try {
      await updatePlan(plan.id, { is_default: true });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    }
  };

  const confirmArchive = async () => {
    setBusy(true);
    setDialogError(null);
    try {
      await archivePlan(pendingArchive.id);
      setPendingArchive(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      // Inside the dialog: a page-level banner renders behind the overlay,
      // leaving the dialog open with no explanation.
      setDialogError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">Plans</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            Tiers shown on /plans, and the daily request limits enforced on every
            signed-in call. Applied immediately, without a redeploy.
          </p>
        </div>
        <button
          onClick={() => setForm({ ...BLANK })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold
            bg-primary text-primary-foreground hover:opacity-90 cursor-pointer transition-opacity"
        >
          <Plus size={14} /> New plan
        </button>
      </header>

      {error && (
        <p role="alert" className="text-[13px] text-destructive bg-accent rounded-md px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {form && (
        <form
          onSubmit={save}
          className="rounded-lg border bg-card p-5 mb-5 grid gap-4 sm:grid-cols-2"
          style={{ borderColor: 'var(--border)' }}
        >
          <div>
            <label htmlFor="plan-name" className="block text-[12px] font-semibold text-card-foreground mb-1.5">Name</label>
            <input
              id="plan-name" required maxLength={60} value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={INPUT} style={{ borderColor: 'var(--input)' }}
            />
          </div>

          <div>
            <label htmlFor="plan-slug" className="block text-[12px] font-semibold text-card-foreground mb-1.5">Slug</label>
            <input
              id="plan-slug" required maxLength={40} value={form.slug}
              disabled={Boolean(form.id)}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className={`${INPUT} disabled:opacity-50`}
              style={{ borderColor: slugInvalid ? 'var(--destructive)' : 'var(--input)' }}
              aria-invalid={Boolean(slugInvalid)}
            />
            <p className={`text-[11.5px] mt-1 ${slugInvalid ? 'text-destructive' : 'text-muted-foreground'}`}>
              {form.id
                ? 'The slug is fixed once a plan exists — users may be assigned to it.'
                : 'Lowercase letters, numbers and hyphens only.'}
            </p>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="plan-desc" className="block text-[12px] font-semibold text-card-foreground mb-1.5">Description</label>
            <input
              id="plan-desc" value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={INPUT} style={{ borderColor: 'var(--input)' }}
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="plan-features" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
              Features
            </label>
            <textarea
              id="plan-features" rows={6} value={form.featuresText}
              onChange={(e) => setForm({ ...form, featuresText: e.target.value })}
              className={INPUT} style={{ borderColor: 'var(--input)' }}
            />
            <p className="text-[11.5px] mt-1 text-muted-foreground">One bullet per line.</p>
          </div>

          <div>
            <label htmlFor="plan-rpd" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
              Requests per day
            </label>
            <input
              id="plan-rpd" type="number" min={0} value={form.requestsPerDay}
              onChange={(e) => setForm({ ...form, requestsPerDay: e.target.value })}
              className={INPUT} style={{ borderColor: 'var(--input)' }}
              placeholder="Unlimited"
            />
            <p className="text-[11.5px] mt-1 text-muted-foreground">
              Leave empty (or 0) for unlimited. Enforced per signed-in user, resetting at
              00:00 UTC. Administrators are always exempt.
            </p>
          </div>

          <div>
            <label htmlFor="plan-badge" className="block text-[12px] font-semibold text-card-foreground mb-1.5">Badge</label>
            <input
              id="plan-badge" maxLength={24} value={form.badge}
              onChange={(e) => setForm({ ...form, badge: e.target.value })}
              className={INPUT} style={{ borderColor: 'var(--input)' }}
              placeholder="e.g. Planned"
            />
            <p className="text-[11.5px] mt-1 text-muted-foreground">
              Optional. A plan with a badge is highlighted on the pricing page.
            </p>
          </div>

          {/* ── Pricing ──────────────────────────────────────────────────── */}
          <div className="sm:col-span-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
              Pricing
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="plan-price" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
                  Monthly price (minor units)
                </label>
                <input
                  id="plan-price" type="number" min={0} step={1} value={form.priceCents}
                  onChange={(e) => setForm({ ...form, priceCents: e.target.value })}
                  className={INPUT} style={{ borderColor: 'var(--input)' }}
                  placeholder="e.g. 250000 = LKR 2,500"
                />
                <p className="text-[11.5px] mt-1 text-muted-foreground">
                  Store in minor units (cents / සත). Leave empty for a free / unpriced tier —
                  no price is shown and the Upgrade button is hidden.
                </p>
              </div>

              <div>
                <label htmlFor="plan-annual-price" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
                  Annual price (minor units, optional)
                </label>
                <input
                  id="plan-annual-price" type="number" min={0} step={1} value={form.annualPriceCents}
                  onChange={(e) => setForm({ ...form, annualPriceCents: e.target.value })}
                  className={INPUT} style={{ borderColor: 'var(--input)' }}
                  placeholder="e.g. 2400000 = LKR 24,000/yr"
                />
                <p className="text-[11.5px] mt-1 text-muted-foreground">
                  Must be ≤ 12 × monthly price. A saving % is shown on the card.
                </p>
              </div>

              <div>
                <label htmlFor="plan-billing-period" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
                  Billing period
                </label>
                <select
                  id="plan-billing-period" value={form.billingPeriod}
                  onChange={(e) => setForm({ ...form, billingPeriod: e.target.value })}
                  className={`${INPUT} cursor-pointer`} style={{ borderColor: 'var(--input)' }}
                >
                  {BILLING_PERIODS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="plan-cta-label" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
              Button label
            </label>
            <input
              id="plan-cta-label" maxLength={40} value={form.ctaLabel}
              onChange={(e) => setForm({ ...form, ctaLabel: e.target.value })}
              className={INPUT} style={{ borderColor: 'var(--input)' }}
              placeholder="e.g. Join the waitlist"
            />
            <p className="text-[11.5px] mt-1 text-muted-foreground">
              Leave empty for no button. The user&apos;s own tier always shows
              &ldquo;Current plan&rdquo; instead.
            </p>
          </div>

          <div>
            <label htmlFor="plan-cta-href" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
              Button link
            </label>
            <input
              id="plan-cta-href" maxLength={512} value={form.ctaHref}
              onChange={(e) => setForm({ ...form, ctaHref: e.target.value })}
              className={INPUT} style={{ borderColor: 'var(--input)' }}
              placeholder="https://… or mailto:…"
            />
            <p className="text-[11.5px] mt-1 text-muted-foreground">
              Must start with https://, http://, mailto: or / — anything else is
              rejected, because this renders as a link on the public page.
            </p>
          </div>

          <div>
            <label htmlFor="plan-sort" className="block text-[12px] font-semibold text-card-foreground mb-1.5">Sort order</label>
            <input
              id="plan-sort" type="number" value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              className={INPUT} style={{ borderColor: 'var(--input)' }}
            />
          </div>

          <div className="flex items-end gap-5">
            <label className="flex items-center gap-2 text-[13px] text-card-foreground cursor-pointer">
              <input
                type="checkbox" checked={form.isVisible}
                onChange={(e) => setForm({ ...form, isVisible: e.target.checked })}
              />
              Visible on /plans
            </label>
            <label className="flex items-center gap-2 text-[13px] text-card-foreground cursor-pointer">
              <input
                type="checkbox" checked={form.isDefault}
                onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
              />
              Default for new users
            </label>
          </div>

          <div className="sm:col-span-2 flex items-center gap-2">
            <button
              type="submit" disabled={busy || slugInvalid}
              className="px-3 py-1.5 rounded-md text-[13px] font-semibold bg-primary
                text-primary-foreground hover:opacity-90 cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Save plan'}
            </button>
            <button
              type="button" onClick={() => setForm(null)}
              className="px-3 py-1.5 rounded-md text-[13px] font-semibold text-muted-foreground
                hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border bg-card overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-muted-foreground border-b" style={{ borderColor: 'var(--border)' }}>
              <th className="px-4 py-2.5 font-semibold">Plan</th>
              <th className="px-4 py-2.5 font-semibold">Price</th>
              <th className="px-4 py-2.5 font-semibold">Daily limit</th>
              <th className="px-4 py-2.5 font-semibold">State</th>
              <th className="px-4 py-2.5 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((plan) => {
              const archived = Boolean(plan.archived_at);
              return (
                <tr key={plan.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-card-foreground">{plan.name}</span>
                    <span className="text-muted-foreground ml-2">{plan.slug}</span>
                  </td>
                  <td className="px-4 py-3 text-card-foreground">
                    {plan.price_cents != null
                      ? formatPrice(plan.price_cents, plan.currency)
                      : <span className="text-muted-foreground">Free</span>}
                  </td>
                  <td className="px-4 py-3 text-card-foreground">
                    {plan.limits?.requests_per_day
                      ? `${plan.limits.requests_per_day}/day`
                      : 'Unlimited'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
                      {plan.is_default && (
                        <span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-semibold">Default</span>
                      )}
                      {!plan.is_visible && (
                        <span className="px-1.5 py-0.5 rounded bg-accent text-muted-foreground font-semibold">Hidden</span>
                      )}
                      {archived && (
                        <span className="px-1.5 py-0.5 rounded bg-accent text-muted-foreground font-semibold">Archived</span>
                      )}
                      {plan.cta_label && (
                        <span className="px-1.5 py-0.5 rounded bg-accent text-muted-foreground font-semibold">
                          {plan.cta_label}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {!plan.is_default && !archived && (
                        <button
                          onClick={() => makeDefault(plan)}
                          title="Make this the default for new users"
                          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                        >
                          <Star size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => setForm(toForm(plan))}
                        title="Edit"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      {!archived && (
                        <button
                          onClick={() => { setPendingArchive(plan); setDialogError(null); }}
                          title={plan.is_default ? 'The default plan cannot be archived' : 'Archive'}
                          disabled={plan.is_default}
                          className="p-1.5 rounded-md text-muted-foreground hover:text-destructive
                            hover:bg-accent cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Archive size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No plans yet. Run the 2026-09-16-plans migration, or create one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(pendingArchive)}
        title={pendingArchive ? `Archive ${pendingArchive.name}?` : ''}
        description={
          'It disappears from the pricing page. Users already on it keep the '
          + 'assignment and are still metered by its limits, so nobody is cut '
          + 'off — reassign them first if that is not what you want.'
        }
        current="Listed on /plans"
        next="Archived and hidden"
        confirmLabel="Archive"
        destructive
        busy={busy}
        error={dialogError}
        onConfirm={confirmArchive}
        onCancel={() => { setPendingArchive(null); setDialogError(null); }}
      />
    </div>
  );
}
