import { useState } from 'react';
import {
  LayoutDashboard, SpellCheck, Newspaper, PenLine, FileText,
  History, Settings, ChevronLeft, ChevronRight, User, Zap, Bot, Scale, X,
} from 'lucide-react';
import DotField from './DotField';

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Writing tools',
    items: [
      { id: 'grammar',    label: 'Grammar Checker',    icon: SpellCheck },
      { id: 'headlines',  label: 'Headline Generator', icon: Newspaper },
      { id: 'rewriter',   label: 'Style Rewriter',     icon: PenLine },
      { id: 'summarizer', label: 'News Summarizer',    icon: FileText },
    ],
  },
  {
    label: 'Research',
    items: [
      { id: 'sinllama',              label: 'SinLLaMA Playground', icon: Bot },
      { id: 'summarizer_playground', label: 'Summarizer Lab',      icon: Layers },
      { id: 'comparison',            label: 'Model Comparison',    icon: Scale },
    ],
  },
];

const BOTTOM_NAV = [
  { id: 'history',  label: 'History',  icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ activeTool, onSelectTool, isOpen, onToggle, collapsed, onCollapse }) {
  const [profileOpen, setProfileOpen] = useState(false);

  const select = (id) => {
    onSelectTool(id);
    if (window.innerWidth < 1024) onToggle();
  };

  const renderNavItem = ({ id, label, icon: Icon }) => {
    const isActive = activeTool === id;
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
          text-[13px] font-medium transition-colors duration-150
          ${isActive
            ? 'bg-white/[0.08] text-white'
            : 'text-white/55 hover:text-white hover:bg-white/[0.05]'}
        `}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4.5 w-[3px] rounded-full bg-brand-500" aria-hidden="true" />
        )}
        <Icon
          size={17}
          strokeWidth={2}
          className={`shrink-0 ${isActive ? 'text-brand-400' : 'text-white/45 group-hover:text-white/70'}`}
        />
        {!collapsed && <span className="truncate">{label}</span>}
      </button>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-ink-950/50 backdrop-blur-[2px] z-40 lg:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Primary navigation"
        className={`
          fixed inset-y-0 left-0 z-50 overflow-hidden
          ${collapsed ? 'w-[4.75rem]' : 'w-[17rem]'} bg-ink-950
          flex flex-col shrink-0
          transition-all duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Ambient dot field — kept subtle so text stays readable */}
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
          gradientFrom="rgba(233,115,113,0.35)"
          gradientTo="rgba(255,255,255,0.05)"
          glowColor="#cd191a"
        />

        {/* Brand */}
        <div className={`relative z-10 flex items-center gap-3 pt-5 pb-4 ${collapsed ? 'justify-center px-2' : 'px-5'}`}>
          <div className="w-9 h-9 rounded-xl bg-brand-600 shadow-lg shadow-brand-950/40 flex items-center justify-center shrink-0">
            <img src="/logo.png" alt="" className="w-full h-full object-contain p-1.5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span
                className="text-white leading-none tracking-tight"
                style={{ fontSize: '22px', fontFamily: "'Gwen', 'Satoshi', sans-serif" }}
              >
                SinAi
              </span>
              <span className="text-[9.5px] text-white/35 uppercase tracking-[0.18em] mt-1">
                Journalism AI
              </span>
            </div>
          )}
          <button
            id="sidebar-collapse"
            onClick={onCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`hidden lg:flex items-center justify-center w-7 h-7 rounded-lg text-white/40
              hover:text-white hover:bg-white/10 transition-colors duration-150 cursor-pointer
              ${collapsed ? 'absolute top-1.5 right-1.5' : 'ml-auto'}`}
          >
            {collapsed ? <ChevronRight size={15} strokeWidth={2} /> : <ChevronLeft size={15} strokeWidth={2} />}
          </button>
          {/* Mobile close */}
          <button
            onClick={onToggle}
            className="lg:hidden ml-auto flex items-center justify-center w-8 h-8 rounded-lg text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
            aria-label="Close navigation"
          >
            <X size={17} />
          </button>
        </div>

        {/* Navigation */}
        <nav className={`relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-2 space-y-5 ${collapsed ? 'px-3' : 'px-3.5'}`}>
          {NAV_SECTIONS.map((section) => (
            <div key={section.label}>
              {!collapsed && (
                <p className="px-3 mb-1.5 text-[9.5px] font-bold text-white/30 uppercase tracking-[0.16em]">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map(renderNavItem)}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom navigation */}
        <div className={`relative z-10 py-3 space-y-0.5 border-t border-white/[0.07] ${collapsed ? 'px-3' : 'px-3.5'}`}>
          {BOTTOM_NAV.map(renderNavItem)}
        </div>

        {/* User */}
        <div className={`relative z-10 pb-4 pt-1 ${collapsed ? 'px-3' : 'px-3.5'}`}>
          <button
            id="user-profile-btn"
            onClick={() => setProfileOpen((v) => !v)}
            className={`
              w-full flex items-center gap-2.5 rounded-xl cursor-pointer
              ${collapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-2'}
              hover:bg-white/[0.06] transition-colors duration-150
            `}
          >
            <div className="w-8.5 h-8.5 rounded-lg bg-gradient-to-br from-brand-500 to-brand-800 flex items-center justify-center shrink-0 text-white text-[12px] font-bold">
              J
            </div>
            {!collapsed && (
              <div className="text-left min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-[12.5px] font-semibold text-white truncate">Journalist</p>
                  <span className="text-[8.5px] font-bold text-white/50 bg-white/10 px-1.5 py-px rounded uppercase tracking-wider">
                    Free
                  </span>
                </div>
                <p className="text-[10.5px] text-white/40 truncate">journalist@sinai.lk</p>
              </div>
            )}
          </button>

          {profileOpen && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setProfileOpen(false)} />
              <div className={`absolute ${collapsed ? 'left-full ml-2 w-48' : 'left-3.5 right-3.5'} bottom-[4.25rem] z-50
                bg-white rounded-xl shadow-pop py-1.5 border border-ink-200/80
                animate-in fade-in slide-in-from-bottom-1 duration-150`}>
                {[
                  { id: 'profile-view-btn',     label: 'View profile', icon: User, tool: 'profile' },
                  { id: 'profile-upgrade-btn',  label: 'Plans',        icon: Zap,  tool: 'plans' },
                  { id: 'profile-settings-btn', label: 'Settings',     icon: Settings, tool: 'settings' },
                ].map(({ id, label, icon: Icon, tool }) => (
                  <button
                    key={id}
                    id={id}
                    onClick={() => {
                      select(tool);
                      setProfileOpen(false);
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
        </div>
      </aside>
    </>
  );
}
