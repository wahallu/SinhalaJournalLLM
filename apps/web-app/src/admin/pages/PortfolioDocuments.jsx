import { useEffect, useRef, useState } from 'react';
import { ExternalLink, FileUp, Trash2 } from 'lucide-react';
import {
  deletePortfolioDocument,
  listPortfolioDocuments,
  updatePortfolioDocument,
  uploadPortfolioDocument,
} from '../adminApi';
import ConfirmDialog from '../ConfirmDialog';

const INPUT = `w-full px-3 py-2 text-[13px] rounded-md border bg-background text-foreground
  placeholder:text-muted-foreground focus:outline-none focus:ring-2`;

const INITIAL = {
  title: '',
  category: 'document',
  document_type: 'Group',
  submitted_at: '',
  description: '',
  sort_order: 0,
  is_published: true,
};

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function PortfolioDocuments() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(INITIAL);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [dialogError, setDialogError] = useState(null);
  const fileRef = useRef(null);

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

  const submit = async (event) => {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Choose a document to upload.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (value !== '') body.append(key, String(value));
      });
      body.append('file', file);
      await uploadPortfolioDocument(body);
      setForm(INITIAL);
      if (fileRef.current) fileRef.current.value = '';
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
          Upload reports, presentations, and publications shown on sin-ai.app.
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
          <label htmlFor="document-file" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
            File
          </label>
          <input
            ref={fileRef}
            id="document-file"
            type="file"
            required
            accept=".pdf,.doc,.docx,.ppt,.pptx"
            className={`${INPUT} file:mr-3 file:border-0 file:bg-secondary file:px-2 file:py-1 file:text-[12px]`}
            style={{ borderColor: 'var(--input)' }}
          />
          <p className="mt-1 text-[11.5px] text-muted-foreground">PDF, Word, or PowerPoint. Maximum 25 MB.</p>
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
            Publish on the portfolio immediately
          </label>
          <button
            type="submit"
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold
              bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
          >
            <FileUp size={14} /> {busy ? 'Uploading…' : 'Upload document'}
          </button>
        </div>
      </form>

      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full min-w-[760px] text-[13px]">
          <thead className="bg-muted">
            <tr className="text-left text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Title</th>
              <th className="px-4 py-2.5 font-semibold">Section</th>
              <th className="px-4 py-2.5 font-semibold">Date</th>
              <th className="px-4 py-2.5 font-semibold">Size</th>
              <th className="px-4 py-2.5 font-semibold">Published</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="bg-card">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No documents uploaded yet.
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                <td className="px-4 py-3">
                  <p className="font-medium text-card-foreground">{row.title}</p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5">{row.document_type}</p>
                </td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{row.category}</td>
                <td className="px-4 py-3 text-muted-foreground">{row.submitted_at || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground tabular-nums">{formatSize(row.size_bytes)}</td>
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
                    <a
                      href={row.file_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${row.title}`}
                      className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                    >
                      <ExternalLink size={14} />
                    </a>
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
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete “${pendingDelete?.title}”?`}
        description="This permanently removes the file from the public portfolio and document storage."
        current={pendingDelete?.file_name}
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
