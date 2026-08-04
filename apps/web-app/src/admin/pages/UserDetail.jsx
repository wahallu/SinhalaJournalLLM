import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getUser, getUserHistory, listCategories, updateUser } from '../adminApi';
import ConfirmDialog from '../ConfirmDialog';
import { Skeleton } from '../../components/ui/Skeleton';

const SELECT = `px-3 py-1.5 text-[13px] rounded-md border bg-background text-foreground
  cursor-pointer focus:outline-none focus:ring-2`;

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
        {label}
      </p>
      {children}
    </div>
  );
}

export default function UserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [pending, setPending] = useState(null); // { field, label, current, next, destructive }
  const [busy, setBusy] = useState(false);
  const [dialogError, setDialogError] = useState(null);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [u, cats, h] = await Promise.all([
          getUser(userId),
          listCategories(),
          getUserHistory(userId),
        ]);
        if (!active) return;
        setUser(u);
        setCategories(cats);
        setHistory(h.items ?? []);
      } catch (e) {
        if (active) setError(e.message);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  const confirmChange = async () => {
    setBusy(true);
    setDialogError(null);
    try {
      const updated = await updateUser(userId, { [pending.field]: pending.nextValue });
      setUser(updated);
      setPending(null);
    } catch (e) {
      // The self-lockout guards return 400 with a specific message; showing
      // it verbatim is more useful than a generic failure.
      setDialogError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <p role="alert" className="text-[13px] text-destructive bg-accent rounded-md px-4 py-3">
        {error}
      </p>
    );
  }

  if (!user) {
    return (
      <div role="status" aria-label="Loading user">
        <Skeleton className="h-3.5 w-24 mb-4" />
        <div className="mb-6 space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-56" />
        </div>
        <div
          className="rounded-lg border bg-card p-5 mb-6 grid gap-5 sm:grid-cols-3"
          style={{ borderColor: 'var(--border)' }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-7 w-full" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-card p-5" style={{ borderColor: 'var(--border)' }}>
          <Skeleton className="h-4 w-32 mb-3" />
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const categoryName =
    categories.find((c) => c.id === user.category_id)?.name ?? 'Uncategorized';

  return (
    <div>
      <button
        onClick={() => navigate('/admin/users')}
        className="flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground
          mb-4 cursor-pointer transition-colors"
      >
        <ArrowLeft size={14} /> All users
      </button>

      <header className="mb-6">
        <h1 className="text-[20px] font-semibold text-foreground">{user.full_name || user.email}</h1>
        <p className="text-[13px] text-muted-foreground font-mono mt-0.5">{user.email}</p>
      </header>

      <section
        className="rounded-lg border bg-card p-5 mb-6 grid gap-5 sm:grid-cols-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <Field label="Role">
          <select
            value={user.role}
            onChange={(e) =>
              setPending({
                field: 'role',
                label: 'Change role',
                current: user.role,
                nextValue: e.target.value,
                destructive: e.target.value === 'admin',
                description:
                  e.target.value === 'admin'
                    ? 'Administrators can manage every user, category and setting.'
                    : 'This account will lose access to the admin dashboard.',
              })
            }
            className={SELECT}
            style={{ borderColor: 'var(--input)' }}
          >
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </Field>

        <Field label="Status">
          <select
            value={user.status}
            onChange={(e) =>
              setPending({
                field: 'status',
                label: e.target.value === 'suspended' ? 'Suspend account' : 'Reactivate account',
                current: user.status,
                nextValue: e.target.value,
                destructive: e.target.value === 'suspended',
                description:
                  e.target.value === 'suspended'
                    ? 'They will be signed out of every authenticated route. Their history is preserved.'
                    : 'They regain access immediately.',
              })
            }
            className={SELECT}
            style={{ borderColor: 'var(--input)' }}
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </Field>

        <Field label="Category">
          <select
            value={user.category_id ?? ''}
            onChange={(e) =>
              setPending({
                field: 'category_id',
                label: 'Change category',
                current: categoryName,
                nextValue: e.target.value || null,
                destructive: false,
                description: 'Categories are used for reporting and segmentation.',
              })
            }
            className={SELECT}
            style={{ borderColor: 'var(--input)' }}
          >
            <option value="">Uncategorized</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section className="rounded-lg border bg-card p-5" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-[14px] font-semibold text-card-foreground mb-3">
          Activity — {history.length} {history.length === 1 ? 'entry' : 'entries'}
        </h2>

        {history.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-6 text-center">
            This user has no saved activity.
          </p>
        ) : (
          <ul className="space-y-2">
            {history.map((item) => (
              <li
                key={item.id}
                className="rounded-md border px-3 py-2.5"
                style={{ borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {item.tool}
                  </span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {new Date(item.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-[13px] text-card-foreground mt-1 line-clamp-2">
                  {item.input_preview}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(pending)}
        title={pending?.label ?? ''}
        description={pending?.description}
        current={pending?.current}
        next={
          pending?.field === 'category_id'
            ? categories.find((c) => c.id === pending?.nextValue)?.name ?? 'Uncategorized'
            : pending?.nextValue
        }
        destructive={pending?.destructive}
        busy={busy}
        error={dialogError}
        onConfirm={confirmChange}
        onCancel={() => {
          setPending(null);
          setDialogError(null);
        }}
      />
    </div>
  );
}
