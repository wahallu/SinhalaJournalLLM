import { useEffect, useState } from 'react';
import { ExternalLink, Save } from 'lucide-react';
import { listTeamContacts, updateTeamContact } from '../adminApi';

const INPUT = `w-full px-3 py-2 text-[13px] rounded-md border bg-background text-foreground
  placeholder:text-muted-foreground focus:outline-none focus:ring-2`;

const FIELDS = [
  { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+94 77 123 4567' },
  { key: 'linkedin_url', label: 'LinkedIn', type: 'url', placeholder: 'https://www.linkedin.com/in/…' },
  { key: 'github_url', label: 'GitHub', type: 'url', placeholder: 'https://github.com/…' },
];

function toForm(row) {
  return {
    phone: row.phone || '',
    linkedin_url: row.linkedin_url || '',
    github_url: row.github_url || '',
  };
}

function MemberCard({ row, onSaved }) {
  const [form, setForm] = useState(() => toForm(row));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const dirty = FIELDS.some(({ key }) => form[key] !== (row[key] || ''));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      // Empty strings clear a field; the backend stores them as null.
      const updated = await updateTeamContact(row.student_id, {
        phone: form.phone.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        github_url: form.github_url.trim() || null,
      });
      setForm(toForm(updated));
      setSaved(true);
      onSaved(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-lg border bg-card p-5 grid gap-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <div>
        <p className="text-[14px] font-semibold text-card-foreground">{row.name}</p>
        <p className="text-[11.5px] text-muted-foreground font-mono">{row.student_id}</p>
      </div>

      {FIELDS.map(({ key, label, type, placeholder }) => {
        const id = `${row.student_id}-${key}`;
        const value = form[key];
        return (
          <div key={key}>
            <label htmlFor={id} className="block text-[12px] font-semibold text-card-foreground mb-1.5">
              {label} <span className="font-normal text-muted-foreground">(empty = hidden)</span>
            </label>
            <div className="flex items-center gap-1.5">
              <input
                id={id}
                type={type}
                inputMode={type === 'tel' ? 'tel' : 'url'}
                maxLength={key === 'phone' ? 25 : 300}
                value={value}
                onChange={(event) => setForm({ ...form, [key]: event.target.value })}
                placeholder={placeholder}
                className={INPUT}
                style={{ borderColor: 'var(--input)' }}
              />
              {type === 'url' && value.startsWith('https://') && (
                <a
                  href={value}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${label} for ${row.name}`}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </div>
        );
      })}

      {error && (
        <p role="alert" className="text-[12.5px] text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-end gap-3">
        {saved && !dirty && <span role="status" className="text-[12px] text-muted-foreground">Saved</span>}
        <button
          type="submit"
          disabled={busy || !dirty}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold
            bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
        >
          <Save size={14} />
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}

export default function TeamContacts() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listTeamContacts();
        if (active) setRows(data);
      } catch (err) {
        if (active) setError(err.message);
      }
    })();
    return () => { active = false; };
  }, []);

  const replaceRow = (updated) => {
    setRows((current) => current.map((row) => (row.student_id === updated.student_id ? updated : row)));
  };

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-[20px] font-semibold text-foreground">Team contacts</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Phone, LinkedIn and GitHub shown on each member's card in the team section of sin-ai.app.
          Leave a field empty to hide it. Changes appear on the site straight away.
        </p>
      </header>

      {error && (
        <p role="alert" className="text-[13px] text-destructive bg-accent rounded-md px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {rows === null && !error && (
        <p className="text-[13px] text-muted-foreground">Loading…</p>
      )}

      {rows && rows.length === 0 && (
        <p className="text-[13px] text-muted-foreground">
          No team members found. Run the migration 2026-10-19-portfolio-team-contacts.sql.
        </p>
      )}

      {rows && rows.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((row) => (
            <MemberCard key={row.student_id} row={row} onSaved={replaceRow} />
          ))}
        </div>
      )}
    </div>
  );
}
