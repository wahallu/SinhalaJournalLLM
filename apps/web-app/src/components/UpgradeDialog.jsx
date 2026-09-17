import { useEffect, useState } from 'react';
import { Building2, Loader2, X } from 'lucide-react';
import { getPaymentDetails, requestUpgrade } from '../services/api';
import { useLanguage } from '../i18n/useLanguage.js';
import { T } from '../i18n/T.jsx';
import { formatPrice } from '../lib/money.js';

/**
 * Bank-transfer upgrade.
 *
 * Deliberately NOT a checkout. There is no payment gateway, so this collects
 * nothing that looks like one — no card fields, no "Pay now" — and it never
 * claims the upgrade has happened. It shows where to send the money, takes
 * the reference from the transfer slip, and says plainly that an
 * administrator confirms it.
 *
 * A form that looked like a payment while taking none would be the worst
 * version of this feature.
 */
function DetailRow({ k, value }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-[12px] text-ink-500"><T k={k} /></span>
      <span className="break-all text-right text-[13px] font-semibold text-ink-900">{value}</span>
    </div>
  );
}

export default function UpgradeDialog({ plan, onClose, onSubmitted }) {
  const { tu } = useLanguage();
  const [details, setDetails] = useState(null);
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPaymentDetails()
      .then((d) => { if (active) setDetails(d); })
      .catch(() => { if (active) setDetails({}); });
    return () => { active = false; };
  }, []);

  const complete = Boolean(details?.bank_name && details?.account_name && details?.account_number);

  const submit = async (event) => {
    event.preventDefault();
    if (!reference.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await requestUpgrade({ planId: plan.id, paymentReference: reference.trim(), note });
      onSubmitted?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={tu('plans.upgradeTo')}
        className="w-full max-w-lg overflow-hidden rounded-t-2xl bg-white shadow-pop dark:bg-ink-50 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink-200/80 px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-ink-950">
              <T k="plans.upgradeTo" /> {plan.name}
            </h2>
            {plan.price_cents != null && (
              <p className="mt-0.5 text-[12.5px] text-ink-500">
                {formatPrice(plan.price_cents, plan.currency)} ·{' '}
                <T k={plan.billing_period === 'yearly' ? 'plans.perYear'
                  : plan.billing_period === 'one_off' ? 'plans.oneOff' : 'plans.perMonth'} />
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={tu('common.close')}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-900"
          >
            <X size={17} />
          </button>
        </div>

        <form onSubmit={submit} className="max-h-[70vh] overflow-y-auto px-5 py-4">
          <p className="text-[12.5px] leading-relaxed text-ink-600">
            <T k="plans.bankTransferIntro" />
          </p>

          {details === null ? (
            <div className="mt-4 flex items-center gap-2 text-[12.5px] text-ink-400">
              <Loader2 size={14} className="animate-spin" /> <T k="common.loading" />
            </div>
          ) : complete ? (
            <div className="mt-4 rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-ink-500">
                <Building2 size={13} /> <T k="plans.howToPay" />
              </div>
              <DetailRow k="plans.bank" value={details.bank_name} />
              <DetailRow k="plans.accountName" value={details.account_name} />
              <DetailRow k="plans.accountNumber" value={details.account_number} />
              {details.branch && <DetailRow k="plans.branch" value={details.branch} />}
              {details.instructions && (
                <p className="mt-2 whitespace-pre-line border-t border-ink-200 pt-2 text-[12px] leading-relaxed text-ink-600">
                  {details.instructions}
                </p>
              )}
            </div>
          ) : (
            <p className="mt-4 rounded-xl border border-dashed border-ink-300 bg-ink-50 px-4 py-3 text-[12.5px] text-ink-500">
              <T k="plans.noBankDetails" />
            </p>
          )}

          <div className="mt-4">
            <label htmlFor="upgrade-ref" className="mb-1.5 block text-[12px] font-semibold text-ink-700">
              <T k="plans.reference" />
            </label>
            <input
              id="upgrade-ref"
              required
              maxLength={120}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full min-h-11 rounded-xl border border-ink-200 bg-white px-3.5 text-[14px]
                text-ink-900 outline-none transition-colors hover:border-ink-300
                focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:bg-ink-50"
            />
            <p className="mt-1 text-[11.5px] text-ink-400"><T k="plans.referenceHint" /></p>
          </div>

          <div className="mt-3">
            <label htmlFor="upgrade-note" className="mb-1.5 block text-[12px] font-semibold text-ink-700">
              <T k="plans.noteOptional" />
            </label>
            <textarea
              id="upgrade-note"
              rows={2}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-[14px]
                text-ink-900 outline-none transition-colors hover:border-ink-300
                focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:bg-ink-50"
            />
          </div>

          {error && <p role="alert" className="mt-3 text-[12px] text-brand-700">{error}</p>}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-ink-600 hover:bg-ink-100"
            >
              <T k="common.cancel" />
            </button>
            <button
              type="submit"
              disabled={busy || !reference.trim()}
              className="cursor-pointer rounded-xl bg-brand-600 px-5 py-2.5 text-[13.5px] font-semibold
                text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <T k="profile.saving" /> : <T k="plans.submitRequest" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
