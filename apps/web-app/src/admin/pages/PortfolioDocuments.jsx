import { useEffect, useState } from 'react';
import { ExternalLink, Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import {
  createPortfolioDocumentLink,
  deletePortfolioDocument,
  listPortfolioDocuments,
  updatePortfolioDocument,
} from '../adminApi';
import ConfirmDialog from '../ConfirmDialog';
import { linkHost, parseDocumentLink } from '../documentLink';

const INPUT = `w-full px-3 py-2 text-[13px] rounded-md border bg-background text-foreground
  placeholder:text-muted-foreground focus:outline-none focus:ring-2`;

const INITIAL = {
  title: '',
  category: 'document',
  document_type: 'Group',
  submitted_at: '',
  description: '',
  file_url: '',
  sort_order: 0,
  is_published: true,
};

function toForm(row) {
  return {
    title: row.title,
    category: row.category,
    document_type: row.document_type,
    submitted_at: row.submitted_at || '',
    description: row.description || '',
    file_url: row.file_url || '',
    sort_order: row.sort_order ?? 0,
    is_published: row.is_published,
  };
}

export default function PortfolioDocuments() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(INITIAL);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [dialogError, setDialogError] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listPortfolioDocuments();
        if (active) {
          setRows(data);
          setError(null);
        }
      } catch (err) {
        if (active) setError(err.message);
      }
    })();
    return () => { active = false; };
  }, [refreshKey]);

  const resetForm = () => {
    setForm(INITIAL);
    setEditingId(null);
  };

  const startEdit = (row) => {
    setForm(toForm(row));
    setEditingId(row.id);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event) => {
    event.preventDefault();
    const link = parseDocumentLink(form.file_url);
    if (link.error) {
      setError(link.error);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const body = {
        title: form.title.trim(),
        category: form.category,
        document_type: form.document_type.trim(),
        submitted_at: form.submitted_at || null,
        description: form.description.trim() || null,
        file_url: link.value,
        is_published: form.is_published,
        sort_order: Number(form.sort_order) || 0,
      };
      if (editingId) {
        await updatePortfolioDocument(editingId, body);
      } else {
        await createPortfolioDocumentLink(body);
      }
      resetForm();
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const togglePublished = async (row) => {
    setBusy(true);
    setError(null);
    try {
      await updatePortfolioDocument(row.id, { is_published: !row.is_published });
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    setBusy(true);
    setDialogError(null);
    try {
      await deletePortfolioDocument(pendingDelete.id);
      if (editingId === pendingDelete.id) resetForm();
      setPendingDelete(null);
      setRefreshKey((key) => key + 1);
    } catch (err) {
      setDialogError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-[20px] font-semibold text-foreground">Portfolio documents</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          Add links to the reports, presentations, and publications shown on sin-ai.app.
          Host each file anywhere (Google Drive, OneDrive, GitHub) and paste its public
          sharing link. Leave the link empty to show the item as Pending.
        </p>
      </header>

      {error && (
        <p role="alert" className="text-[13px] text-destructive bg-accent rounded-md px-4 py-3 mb-4">
          {error}
        </p>
      )}

      <form
        onSubmit={submit}
        className="rounded-lg border bg-card p-5 mb-6 grid gap-4 sm:grid-cols-2"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="sm:col-span-2">
          <p className="text-[13px] font-semibold text-card-foreground">
            {editingId ? 'Edit document' : 'Add a document'}
          </p>
        </div>

        <div>
          <label htmlFor="document-title" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            Title
          </label>
          <input
            id="document-title"
            required
            maxLength={160}
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            className={INPUT}
            style={{ borderColor: 'var(--input)' }}
          />
        </div>

        <div>
          <label htmlFor="document-link" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            Link <span className="font-normal text-muted-foreground">(empty = Pending)</span>
          </label>
          <input
            id="document-link"
            type="url"
            inputMode="url"
            maxLength={500}
            value={form.file_url}
            onChange={(event) => setForm({ ...form, file_url: event.target.value })}
            placeholder="https://drive.google.com/file/d/…"
            className={INPUT}
            style={{ borderColor: 'var(--input)' }}
          />
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            Must start with https:// and be viewable without signing in.
          </p>
        </div>

        <div>
          <label htmlFor="document-category" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            Section
          </label>
          <select
            id="document-category"
            value={form.category}
            onChange={(event) => setForm({ ...form, category: event.target.value })}
            className={INPUT}
            style={{ borderColor: 'var(--input)' }}
          >
            <option value="document">Documents</option>
            <option value="presentation">Presentations</option>
            <option value="publication">Publications</option>
          </select>
        </div>

        <div>
          <label htmlFor="document-type" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            Type label
          </label>
          <input
            id="document-type"
            required
            maxLength={80}
            value={form.document_type}
            onChange={(event) => setForm({ ...form, document_type: event.target.value })}
            placeholder="Group, Individual, Research paper…"
            className={INPUT}
            style={{ borderColor: 'var(--input)' }}
          />
        </div>

        <div>
          <label htmlFor="document-date" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            Submitted date
          </label>
          <input
            id="document-date"
            type="date"
            value={form.submitted_at}
            onChange={(event) => setForm({ ...form, submitted_at: event.target.value })}
            className={INPUT}
            style={{ borderColor: 'var(--input)' }}
          />
        </div>

        <div>
          <label htmlFor="document-order" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            Sort order
          </label>
          <input
            id="document-order"
            type="number"
            value={form.sort_order}
            onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
            className={INPUT}
            style={{ borderColor: 'var(--input)' }}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="document-description" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            Description <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="document-description"
            maxLength={500}
            rows={3}
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            className={INPUT}
            style={{ borderColor: 'var(--input)' }}
          />
        </div>

        <div className="sm:col-span-2 flex items-center justify-between gap-4">
          <label className="flex items-center gap-2 text-[13px] text-card-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(event) => setForm({ ...form, is_published: event.target.checked })}
            />
            Publish on the portfolio
          </label>
          <div className="flex items-center gap-2">
            {editingId && (
              <button
                type="button"
                disabled={busy}
                onClick={resetForm}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold
                  border text-card-foreground hover:bg-muted disabled:opacity-50 cursor-pointer"
                style={{ borderColor: 'var(--border)' }}
              >
                <X size={14} /> Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold
                bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
            >
              {editingId ? <Save size={14} /> : <Plus size={14} />}
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Add document'}
            </button>
          </div>
        </div>
      </form>

      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="bg-muted">
            <tr className="text-left text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Title</th>
              <th className="px-4 py-2.5 font-semibold">Section</th>
              <th className="px-4 py-2.5 font-semibold">Date</th>
              <th className="px-4 py-2.5 font-semibold">Link</th>
              <th className="px-4 py-2.5 font-semibold">Published</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="bg-card">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No documents added yet.
                </td>
              </tr>
            ) : rows.map((row) => {
              const host = linkHost(row.file_url);
              return (
                <tr key={row.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-card-foreground">{row.title}</p>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5">{row.document_type}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{row.category}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.submitted_at || '—'}</td>
                  <td className="px-4 py-3">
                    {host ? (
                      <span className="text-muted-foreground">{host}</span>
                    ) : (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => togglePublished(row)}
                      className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold cursor-pointer disabled:opacity-50 ${
                        row.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {row.is_published ? 'Published' : 'Draft'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        aria-label={`Edit ${row.title}`}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      {host && (
                        <a
                          href={row.file_url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${row.title}`}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setPendingDelete(row)}
                        aria-label={`Delete ${row.title}`}
                        className="p-1.5 rounded-md text-destructive hover:bg-muted cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete “${pendingDelete?.title}”?`}
        description="This removes the entry from the public portfolio. A file hosted elsewhere is not touched."
        current={pendingDelete?.file_url || 'Pending (no link)'}
        next="deleted"
        confirmLabel="Delete document"
        destructive
        busy={busy}
        error={dialogError}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPendingDelete(null);
          setDialogError(null);
        }}
      />
    </div>
  );
}
