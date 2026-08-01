import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { createCategory, deleteCategory, listCategories, updateCategory } from '../adminApi';
import ConfirmDialog from '../ConfirmDialog';

const INPUT = `w-full px-3 py-2 text-[13px] rounded-md border bg-background text-foreground
  placeholder:text-muted-foreground focus:outline-none focus:ring-2`;

const BLANK = { name: '', slug: '', description: '', is_active: true, sort_order: 0 };

/** Mirrors the API's ^[a-z0-9-]+$ so the user sees the problem before submitting. */
const SLUG_PATTERN = /^[a-z0-9-]+$/;

export default function Categories() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null); // null = closed; {id?, ...fields} = open
  const [pendingDelete, setPendingDelete] = useState(null);
  const [dialogError, setDialogError] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  // Mutations bump this to trigger a refetch, rather than calling a shared
  // loader from the effect — which the lint rule reads as a synchronous
  // setState inside the effect body.
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const data = await listCategories();
        if (!active) return;
        setRows(data);
        setError(null);
      } catch (e) {
        if (active) setError(e.message);
      }
    })();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  const slugInvalid = form && form.slug && !SLUG_PATTERN.test(form.slug);

  const save = async (e) => {
    e.preventDefault();
    if (slugInvalid) return;
    setBusy(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        description: form.description || null,
        is_active: form.is_active,
        sort_order: Number(form.sort_order) || 0,
      };
      if (form.id) await updateCategory(form.id, payload);
      else await createCategory(payload);
      setForm(null);
      setRefreshKey((k) => k + 1);
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
      await deleteCategory(pendingDelete.id);
      setPendingDelete(null);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      // Surfaced inside the dialog: the page-level banner would render
      // behind the overlay, leaving the dialog open with no explanation.
      setDialogError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">Categories</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            What users identify as. Used for reporting and segmentation.
          </p>
        </div>
        <button
          onClick={() => setForm({ ...BLANK })}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[13px] font-semibold
            bg-primary text-primary-foreground hover:opacity-90 cursor-pointer transition-opacity"
        >
          <Plus size={14} /> New category
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
            <label htmlFor="cat-name" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
              Name
            </label>
            <input
              id="cat-name"
              required
              maxLength={60}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={INPUT}
              style={{ borderColor: 'var(--input)' }}
            />
          </div>

          <div>
            <label htmlFor="cat-slug" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
              Slug
            </label>
            <input
              id="cat-slug"
              required
              maxLength={60}
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className={INPUT}
              style={{ borderColor: slugInvalid ? 'var(--destructive)' : 'var(--input)' }}
              aria-invalid={Boolean(slugInvalid)}
            />
            <p className={`text-[11.5px] mt-1 ${slugInvalid ? 'text-destructive' : 'text-muted-foreground'}`}>
              Lowercase letters, numbers and hyphens only.
            </p>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="cat-desc" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
              Description
            </label>
            <input
              id="cat-desc"
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={INPUT}
              style={{ borderColor: 'var(--input)' }}
            />
          </div>

          <div>
            <label htmlFor="cat-order" className="block text-[12px] font-semibold text-card-foreground mb-1.5">
              Sort order
            </label>
            <input
              id="cat-order"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
              className={INPUT}
              style={{ borderColor: 'var(--input)' }}
            />
          </div>

          <label className="flex items-center gap-2 text-[13px] text-card-foreground self-end pb-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Active — offered to users
          </label>

          <div className="sm:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setForm(null)}
              className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-secondary text-foreground
                hover:opacity-80 cursor-pointer transition-opacity"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || slugInvalid}
              className="px-3 py-1.5 rounded-md text-[13px] font-semibold bg-primary text-primary-foreground
                hover:opacity-90 disabled:opacity-50 cursor-pointer transition-opacity"
            >
              {busy ? 'Saving…' : form.id ? 'Save changes' : 'Create category'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <table className="w-full text-[13px]">
          <thead className="bg-muted">
            <tr className="text-left text-muted-foreground">
              <th className="px-4 py-2.5 font-semibold">Name</th>
              <th className="px-4 py-2.5 font-semibold">Slug</th>
              <th className="px-4 py-2.5 font-semibold">Active</th>
              <th className="px-4 py-2.5 font-semibold">Order</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody className="bg-card">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No categories yet.
                </td>
              </tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} className="border-t" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-2.5 text-card-foreground">{c.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground font-mono text-[12px]">{c.slug}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.is_active ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-2.5 text-muted-foreground tabular-nums">{c.sort_order}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setForm({ ...c })}
                        aria-label={`Edit ${c.name}`}
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-muted cursor-pointer"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => setPendingDelete(c)}
                        aria-label={`Delete ${c.name}`}
                        className="p-1.5 rounded-md text-destructive hover:bg-muted cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={`Delete “${pendingDelete?.name}”?`}
        description="Users in this category become uncategorized. Their accounts and history are not affected."
        current={pendingDelete?.slug}
        next="deleted"
        confirmLabel="Delete category"
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
