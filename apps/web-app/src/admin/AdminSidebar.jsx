import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Tags, SlidersHorizontal, ScrollText,
  Bot, Layers, Scale, ArrowLeft, Moon, Sun,
} from 'lucide-react';

const NAV = [
  { to: '/admin', end: true, label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/users', end: false, label: 'Users', icon: Users },
  { to: '/admin/categories', end: false, label: 'Categories', icon: Tags },
  { to: '/admin/activity', end: false, label: 'Activity', icon: ScrollText },
  { to: '/admin/settings', end: false, label: 'Settings', icon: SlidersHorizontal },
];

/* Research instruments, admin-only since Phase 4. Their endpoints reach the
   GPU box directly and carry no per-user quota, so they are not part of the
   user-facing product. */
const RESEARCH = [
  { to: '/admin/research/playground', label: 'SinLLaMA Playground', icon: Bot },
  { to: '/admin/research/summarizer-lab', label: 'Summarizer Lab', icon: Layers },
  { to: '/admin/research/comparison', label: 'Model Comparison', icon: Scale },
];

export default function AdminSidebar({ dark, onToggleDark }) {
  return (
    <aside
      className="w-60 shrink-0 flex flex-col border-r bg-sidebar"
      style={{ borderColor: 'var(--sidebar-border)' }}
      aria-label="Admin navigation"
    >
      <div className="px-5 pt-5 pb-4">
        <p className="text-[15px] font-semibold text-sidebar-foreground">SinAi Admin</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">Operations console</p>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, end, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`
            }
          >
            <Icon size={16} strokeWidth={2} />
            {label}
          </NavLink>
        ))}

        <p className="px-3 pt-4 pb-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Research
        </p>
        {RESEARCH.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
              }`
            }
          >
            <Icon size={16} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-4 space-y-0.5 border-t pt-3" style={{ borderColor: 'var(--sidebar-border)' }}>
        <button
          onClick={onToggleDark}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium
            text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors cursor-pointer"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
          {dark ? 'Light mode' : 'Dark mode'}
        </button>
        <NavLink
          to="/dashboard"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium
            text-muted-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <ArrowLeft size={16} />
          Back to SinAi
        </NavLink>
      </div>
    </aside>
  );
}
