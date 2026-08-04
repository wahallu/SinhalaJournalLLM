import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { listUsers } from '../adminApi';
import { Skeleton } from '../../components/ui/Skeleton';

const INPUT = `w-full px-3 py-2 text-[13px] rounded-md border bg-background text-foreground
  placeholder:text-muted-foreground focus:outline-none focus:ring-2`;

function Badge({ children, tone = 'muted' }) {
  const tones = {
    muted: 'bg-muted text-muted-foreground',
    accent: 'bg-accent text-accent-foreground',
    destructive: 'bg-destructive text-destructive-foreground',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default function Users() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    // Debounced so typing does not fire a request per keystroke. All state
    // updates happen inside the timer callback rather than in the effect
    // body, which would trigger a cascading render.
    const timer = setTimeout(() => {
      setLoading(true);
      listUsers({ search, role, status })
        .then((data) => {
          if (!active) return;
          setRows(data.items);
          setTotal(data.total);
          setError(null);
        })
        .catch((e) => active && setError(e.message))
        .finally(() => active && setLoading(false));
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, role, status]);

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-[20px] font-semibold text-foreground">Users</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">
          {loading ? 'Loading…' : `${total} ${total === 1 ? 'account' : 'accounts'}`}
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-56">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email…"
            aria-label="Search users"
            className={`${INPUT} pl-8`}
            style={{ borderColor: 'var(--input)' }}
          />
        </div>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          aria-label="Filter by role"
          className={`${INPUT} w-36 cursor-pointer`}
          style={{ borderColor: 'var(--input)' }}
        >
          <option value="">All roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className={`${INPUT} w-40 cursor-pointer`}
          style={{ borderColor: 'var(--input)' }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-destructive bg-accent rounded-md px-4 py-3 mb-4">
          {error}
        </p>
      )}

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="bg-muted">
              <tr className="text-left text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Name</th>
                <th className="px-4 py-2.5 font-semibold">Email</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2.5"><Skeleton className="h-3.5 w-28" /></td>
                    <td className="px-4 py-2.5"><Skeleton className="h-3.5 w-40" /></td>
                    <td className="px-4 py-2.5"><Skeleton className="h-3.5 w-12" /></td>
                    <td className="px-4 py-2.5"><Skeleton className="h-3.5 w-14" /></td>
                    <td className="px-4 py-2.5"><Skeleton className="h-3.5 w-20" /></td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    No users match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                    className="border-t cursor-pointer hover:bg-muted/60 transition-colors"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <td className="px-4 py-2.5 text-card-foreground">{u.full_name || '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono text-[12px]">
                      {u.email}
                    </td>
                    <td className="px-4 py-2.5">
                      {u.role === 'admin' ? <Badge tone="accent">Admin</Badge> : <Badge>User</Badge>}
                    </td>
                    <td className="px-4 py-2.5">
                      {u.status === 'suspended' ? (
                        <Badge tone="destructive">Suspended</Badge>
                      ) : (
                        <Badge>Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
