import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, SpellCheck, Newspaper, PenLine, FileText,
  History, Settings, ChevronLeft, ChevronRight, User, Zap, X,
  LogIn, LogOut,
} from 'lucide-react';
import DotField from './DotField';
import { useAuth } from '../auth/useAuth';
import ConfirmModal from './ui/ConfirmModal';

const TOOL_PATHS = {
  dashboard: '/dashboard',
  grammar: '/grammar',
  headlines: '/headlines',
  rewriter: '/rewriter',
  summarizer: '/summarizer',
  history: '/history',
  settings: '/settings',
  profile: '/profile',
  plans: '/plans',
};

const NAV_SECTIONS = [
  {
    id: 'workspace',
    label: '',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    id: 'writing-tools',
    label: '',
    items: [
      { id: 'grammar', label: 'Grammar Checker', icon: SpellCheck },
      { id: 'headlines', label: 'Headline Generator', icon: Newspaper },
      { id: 'rewriter', label: 'Style Rewriter', icon: PenLine },
      { id: 'summarizer', label: 'News Summarizer', icon: FileText },
    ],
  },
];

const BOTTOM_NAV = [
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ features = {}, activeTool, onSelectTool, isOpen, onToggle, collapsed, onCollapse }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'Guest';
  const displayEmail = user?.email || 'Not signed in';
  const initial = displayName.charAt(0).toUpperCase();

  const select = (id) => {
    if (onSelectTool) {
      onSelectTool(id);
    } else {
      navigate(TOOL_PATHS[id] || `/${id}`);
    }
    if (window.innerWidth < 1024 && onToggle) onToggle();
  };

  const renderNavItem = ({ id, label, icon: Icon }) => {
    const targetPath = TOOL_PATHS[id] || `/${id}`;
    const isActive = activeTool
      ? activeTool === id
      : (location.pathname === targetPath || (id === 'dashboard' && location.pathname === '/'));

    return (
      <button
        key={id}
        id={`nav-${id}`}
        onClick={() => select(id)}
        title={collapsed ? label : undefined}
        aria-current={isActive ? 'page' : undefined}
        className={`
          relative w-full flex items-center gap-3 rounded-lg cursor-pointer
          ${collapsed ? 'justify-center px-0 py-2.5' : 'px-3 py-2'}
          text-[13.5px] font-medium transition-colors duration-150
          ${isActive
            ? 'bg-brand-600 text-white'
            : 'text-ink-900 hover:bg-ink-50'}
        `}
      >
        <Icon
          size={17}
          strokeWidth={2}
          className={`shrink-0 ${isActive ? 'text-white' : 'text-ink-500'}`}
        />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-ink-950/50 dark:bg-black/60 backdrop-blur-[2px] z-40 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Below lg this is a fixed overlay drawer. From lg it is a normal
          in-flow flex child, so it takes its own column in the parent row and
          cannot sit on top of the content.

          It used to stay `fixed` at every width, with a separate spacer div in
          App.jsx repeating the same width to reserve room. That is two sources
          of truth for one measurement, and the reported overlap is what it
          looks like when they disagree. Reproducing that exact disagreement
          here was not possible — every width, both collapsed states, and
          mid-transition all measured zero overlap under the old code too — so
          this is a structural fix for the most plausible cause rather than a
          confirmed repro. In-flow layout makes the class of bug impossible
          regardless.

          `relative`, not `static`: DotField, the collapse chevron and the
          profile menu are all positioned against this element, and `static`
          would silently reparent them to the page. */}
      <aside
        aria-label="Primary navigation"
        className={`
          fixed lg:relative inset-y-0 left-0 lg:h-full z-50 lg:z-auto overflow-hidden
          ${collapsed ? 'w-[4.75rem]' : 'w-[17rem]'} bg-canvas border-r border-ink-100
          flex flex-col shrink-0
          transition-all duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Ambient dot field — kept subtle so text stays readable. Brand-red
            tinted, not white: white dots on the white shell would be
            invisible, so the field now reads as a faint red texture. */}
        <DotField
          className="absolute inset-0 z-0 opacity-25 pointer-events-none"
          dotRadius={1.2}
          dotSpacing={22}
          bulgeStrength={10}
          glowRadius={5}
          sparkle={false}
          waveAmplitude={0}
          cursorRadius={400}
          cursorForce={0.015}
          bulgeOnly
          gradientFrom="rgba(205,25,26,0.35)"
          gradientTo="rgba(205,25,26,0.08)"
          glowColor="#f6c2c1"
        />

        {/* Brand.
            Collapsed, the mark is the only thing that fits, so the logo image
            stands alone and doubles as the expand control — hovering it swaps
            in a chevron. Expanded, the wordmark carries the identity on its
            own and the image would only repeat it, so the slot is given over
            to the wordmark and the collapse control fades in on hover. */}
        <div
          className={`group relative z-10 flex items-center gap-3 pt-5 pb-4
            ${collapsed ? 'justify-center px-2' : 'px-5'}`}
        >
          {collapsed ? (
            <button
              id="sidebar-collapse"
              onClick={onCollapse}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              /* Bordered, not shadow-only: the shell is white again, so a
                 plain white tile needs an edge to read against it. */
              className="relative w-9 h-9 rounded-xl bg-white dark:bg-ink-50 border border-ink-100 shadow-card
                flex items-center justify-center shrink-0 cursor-pointer
                transition-colors duration-150 hover:bg-brand-50"
            >
              <img
                src="/logored.svg"
                alt="SinAi"
                className="w-full h-full object-contain p-1.5 transition-opacity duration-150
                  group-hover:opacity-0"
              />
              <ChevronRight
                size={17}
                strokeWidth={2.5}
                className="absolute text-brand-600 opacity-0 transition-opacity duration-150
                  group-hover:opacity-100"
                aria-hidden="true"
              />
            </button>
          ) : (
            <>
              <span
                className="text-brand-600 leading-none tracking-tight min-w-0 truncate"
                style={{ fontSize: '34px', fontFamily: "'Gwen', 'Satoshi', sans-serif" }}
              >
                SinAi
              </span>
              <button
                id="sidebar-collapse"
                onClick={onCollapse}
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
                className="hidden lg:flex items-center justify-center w-7 h-7 rounded-lg ml-auto
                  text-ink-400 hover:text-ink-900 hover:bg-ink-100 cursor-pointer
                  opacity-0 group-hover:opacity-100 focus-visible:opacity-100
                  transition-all duration-150"
              >
                <ChevronLeft size={15} strokeWidth={2} />
              </button>
            </>
          )}
          {/* Mobile close */}
          <button
            onClick={onToggle}
            className="lg:hidden ml-auto flex items-center justify-center w-8 h-8 rounded-lg text-ink-400 hover:text-ink-900 hover:bg-ink-100 cursor-pointer"
            aria-label="Close navigation"
          >
            <X size={17} />
          </button>
        </div>

        {/* Navigation */}
        <nav className={`relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-2 space-y-5 ${collapsed ? 'px-3' : 'px-3.5'}`}>
          {NAV_SECTIONS.map((section) => {
            /* An admin can switch a tool off; hide it rather than leaving a
               link that lands on a 503. Unknown ids are always shown, so a
               failed /meta fetch cannot blank the navigation. */
            const items = section.items.filter(
              ({ id }) => !(id in features) || features[id] !== false
            );
            if (items.length === 0) return null;
            return (
              <div key={section.id}>
                {!collapsed && (
                  <p className="px-3 mb-1.5 text-[9.5px] font-bold text-ink-400 uppercase tracking-[0.16em]">
                    {section.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {items.map(renderNavItem)}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom navigation */}
        <div className={`relative z-10 py-3 space-y-0.5 border-t border-ink-100 ${collapsed ? 'px-3' : 'px-3.5'}`}>
          {BOTTOM_NAV.map(renderNavItem)}
        </div>

        {/* User — a signed-out visitor gets a real sign-in button rather than
            "Guest / Not signed in" as dead text behind a one-item menu. */}
        <div className={`relative z-10 pb-4 pt-1 ${collapsed ? 'px-3' : 'px-3.5'}`}>
          {user ? (
            <>
              <button
                id="user-profile-btn"
                onClick={() => setProfileOpen((v) => !v)}
                className={`
                  w-full flex items-center gap-2.5 rounded-xl cursor-pointer
                  ${collapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-2'}
                  hover:bg-ink-50 transition-colors duration-150
                `}
              >
                <div className="w-8.5 h-8.5 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center shrink-0 text-white text-[12px] font-bold">
                  {initial}
                </div>
                {!collapsed && (
                  <div className="text-left min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[13px] font-semibold text-ink-900 truncate">{displayName}</p>
                      {profile?.role === 'admin' && (
                        <span className="text-[8.5px] font-bold text-brand-700 bg-brand-50 px-1.5 py-px rounded uppercase tracking-wider">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-400 truncate">{displayEmail}</p>
                  </div>
                )}
              </button>

              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-50" onClick={() => setProfileOpen(false)} />
                  <div className={`absolute ${collapsed ? 'left-full ml-2 w-48' : 'left-3.5 right-3.5'} bottom-[4.25rem] z-50
                    bg-white dark:bg-ink-50 rounded-xl shadow-pop py-1.5 border border-ink-200/80
                    animate-in fade-in slide-in-from-bottom-1 duration-150`}>
                    {[
                      { id: 'profile-view-btn', label: 'View profile', icon: User, tool: 'profile' },
                      { id: 'profile-upgrade-btn', label: 'Plans', icon: Zap, tool: 'plans' },
                      { id: 'profile-settings-btn', label: 'Settings', icon: Settings, tool: 'settings' },
                      { id: 'profile-signout-btn', label: 'Sign out', icon: LogOut, action: 'signout' },
                    ].map(({ id, label, icon: Icon, tool, action }) => (
                      <button
                        key={id}
                        id={id}
                        onClick={async () => {
                          setProfileOpen(false);
                          if (action === 'signout') {
                            setShowSignOutConfirm(true);
                          } else {
                            select(tool);
                          }
                        }}
                        className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] font-medium text-ink-700
                          hover:bg-ink-50 hover:text-brand-700 cursor-pointer transition-colors"
                      >
                        <Icon size={15} strokeWidth={2} className="text-ink-400" />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <button
              id="sidebar-signin"
              onClick={() => navigate('/login', { state: { backgroundLocation: location } })}
              title={collapsed ? 'Sign in' : undefined}
              className={`
                w-full flex items-center gap-2.5 rounded-xl cursor-pointer border border-ink-200
                ${collapsed ? 'justify-center px-0 py-2.5' : 'px-2.5 py-2.5'}
                bg-white dark:bg-ink-50 hover:bg-ink-50 dark:hover:bg-ink-100 hover:border-ink-300 transition-colors duration-150
              `}
            >
              <LogIn size={16} className="text-ink-500 shrink-0" />
              {!collapsed && <span className="text-[13px] font-semibold text-ink-800">Sign in</span>}
            </button>
          )}
        </div>
      </aside>

      <ConfirmModal
        open={showSignOutConfirm}
        onOpenChange={setShowSignOutConfirm}
        title="Sign out"
        description="Are you sure you want to sign out?"
        confirmLabel="Sign out"
        onConfirm={async () => {
          setShowSignOutConfirm(false);
          await signOut();
          navigate('/login');
        }}
      />
    </>
  );
}
