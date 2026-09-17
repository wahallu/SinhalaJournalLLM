import { useEffect, useState } from 'react';
import { Check, X, Landmark } from 'lucide-react';
import {
  getBankDetails, listUpgradeRequests, reviewUpgradeRequest, setBankDetails,
} from '../adminApi';

const INPUT = `w-full px-3 py-2 text-[13px] rounded-md border bg-background text-foreground
  placeholder:text-muted-foreground focus:outline-none focus:ring-2`;

const STATUS_STYLES = {
  pending: 'bg-primary text-primary-foreground',
  approved: 'bg-accent text-foreground',
  declined: 'bg-accent text-muted-foreground',
  cancelled: 'bg-accent text-muted-foreground',
};

/**
 * Upgrade review queue, and the bank details users are told to pay into.
 *
 * Approving here is the ONLY thing that moves a user onto a paid plan —
 * there is no gateway, so a human confirming the transfer arrived is the
 * actual control. Decline carries a note because it is shown back to the
 * user, and "declined" with no reason is a support ticket waiting to happen.
 */
export default function Upgrades() {
  const [rows, setRows] = useState([]);
  const [bank, setBank] = useState(null);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [savingBank, setSavingBank] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [requests, details] = await Promise.all([
          listUpgradeRequests(),
          getBankDetails(),
        ]);
        if (!active) return;
        setRows(requests);
        setBank(details);
        setError(null);
      } catch (e) {
        if (active) setError(e.message);
      }
    })();
    return () => { active = false; };
  }, [refreshKey]);

  const review = async (row, status) => {
    // A decline that says nothing is a support ticket waiting to happen.
    const note = status === 'declined'
      ? window.prompt('Reason for declining (shown to the user):') ?? ''
      : '';
    if (status === 'declined' && !note.trim()) return;

    setBusyId(row.id);
    setError(null);
    try {
      await reviewUpgradeRequest(row.id, status, note.trim() || null);
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  };

  const saveBank = async (e) => {
    e.preventDefault();
    setSavingBank(true);
    setError(null);
    try {
      await setBankDetails(bank);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingBank(false);
    }
  };

  const pendingCount = rows.filter((r) => r.status === 'pending').length;

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-[20px] font-semibold text-foreground">Upgrades</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          There is no payment gateway. A user pays by bank transfer and quotes a
          reference; approving here is what actually moves them onto the plan.
        </p>
      </header>

      {error && (
        <p role="alert" className="text-[13px] text-destructive bg-accent rounded-md px-4 py-3 mb-4">
          {error}
        </p>
      )}

      <form
        onSubmit={saveBank}
        className="rounded-lg border bg-card p-5 mb-6"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Landmark size={15} className="text-muted-foreground" />
          <h2 className="text-[14px] font-semibold text-card-foreground">Bank details</h2>
          <span className="text-[12px] text-muted-foreground">— shown to users on the upgrade form</span>
        </div>

        {bank === null ? (
          <p className="text-[13px] text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['bank_name', 'Bank'],
                ['account_name', 'Account name'],
                ['account_number', 'Account number'],
                ['branch', 'Branch'],
              ].map(([key, label]) => (
                <div key={key}>
                  <label htmlFor={`bank-${key}`} className="block text-[12px] font-semibold text-card-foreground mb-1.5">
                    {label}
                  </label>
                  <input
                    id={`bank-${key}`}
                    value={bank[key] ?? ''}
                    onChange={(e) => setBank({ ...bank, [key]: e.target.value })}
                    className={INPUT}
                    style={{ borderColor: 'var(--input)' }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label htmlFor="bank-instructions" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
                Instructions
              </label>
              <textarea
                id="bank-instructions"
                rows={3}
                value={bank.instructions ?? ''}
                onChange={(e) => setBank({ ...bank, instructions: e.target.value })}
                className={INPUT}
                style={{ borderColor: 'var(--input)' }}
              />
            </div>
            <button
              type="submit"
              disabled={savingBank}
              className="mt-3 px-3 py-1.5 rounded-md text-[13px] font-semibold bg-primary
                text-primary-foreground hover:opacity-90 cursor-pointer disabled:opacity-50"
            >
              {savingBank ? 'Saving…' : 'Save bank details'}
            </button>
          </>
        )}
      </form>

      <h2 className="text-[14px] font-semibold text-foreground mb-2">
        Requests {pendingCount > 0 && (
          <span className="ml-1 rounded bg-primary px-1.5 py-0.5 text-[11px] text-primary-foreground">
            {pendingCount} pending
          </span>
        )}
      </h2>

      <div className="rounded-lg border bg-card overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-muted-foreground border-b" style={{ borderColor: 'var(--border)' }}>
              <th className="px-4 py-2.5 font-semibold">User</th>
              <th className="px-4 py-2.5 font-semibold">Change</th>
              <th className="px-4 py-2.5 font-semibold">Reference</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
              <th className="px-4 py-2.5 font-semibold text-right">Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                <td className="px-4 py-3 text-card-foreground">{row.user_email ?? row.user_id}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {row.from_plan_name ?? '—'} → <span className="font-semibold text-card-foreground">{row.plan_name}</span>
                </td>
                <td className="px-4 py-3 font-mono text-[12px] text-card-foreground">
                  {row.payment_reference ?? '—'}
                  {row.note && <div className="mt-0.5 font-sans text-[11.5px] text-muted-foreground">{row.note}</div>}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-[11.5px] font-semibold ${STATUS_STYLES[row.status]}`}>
                    {row.status}
                  </span>
                  {row.reviewer_note && (
                    <div className="mt-0.5 text-[11.5px] text-muted-foreground">{row.reviewer_note}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.status === 'pending' ? (
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => review(row, 'approved')}
                        disabled={busyId === row.id}
                        title="Confirm payment and move them onto the plan"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer disabled:opacity-40"
                      >
                        <Check size={14} />
                      </button>
                      <button
                        onClick={() => review(row, 'declined')}
                        disabled={busyId === row.id}
                        title="Decline"
                        className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-accent cursor-pointer disabled:opacity-40"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="block text-right text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No upgrade requests yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
