import { useState } from 'react';
import {
  LayoutDashboard, SpellCheck, Newspaper, PenLine, FileText,
  Menu, X, History, Settings, ChevronLeft, ChevronRight, User, LogOut, Zap, Bot, Scale
} from 'lucide-react';
import DotField from './DotField';

const MAIN_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, color: 'text-blue-500' },
  { id: 'grammar', label: 'Grammar Checker', icon: SpellCheck, color: 'text-red-500' },
  { id: 'headlines', label: 'Headline Generator', icon: Newspaper, color: 'text-orange-500' },
  { id: 'rewriter', label: 'Style Rewriter', icon: PenLine, color: 'text-purple-500' },
  { id: 'summarizer', label: 'News Summarizer', icon: FileText, color: 'text-cyan-500' },
  { id: 'sinllama',   label: 'SinLLaMA Playground', icon: Bot, color: 'text-emerald-500' },
  { id: 'comparison',  label: 'Model Comparison', icon: Scale, color: 'text-blue-400' },
];

const BOTTOM_NAV = [
  { id: 'history', label: 'History', icon: History, color: 'text-rose-500' }
];

const SIDEBAR_ACCENT = '#cd191a';

export default function Sidebar({ activeTool, onSelectTool, isOpen, onToggle, collapsed, onCollapse }) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [adVisible, setAdVisible] = useState(true);

  const renderNavItem = ({ id, label, icon: Icon }) => {
    const isActive = activeTool === id;
    return (
      <div key={id} className={`relative flex items-center w-full ${isActive ? 'z-20' : 'z-10'}`}>
        <button
          id={`nav-${id}`}
          onClick={() => {
            onSelectTool(id);
            if (window.innerWidth < 1024) onToggle();
          }}
          title={collapsed ? label : undefined}
          className={`
            group w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-4
            ${collapsed ? 'pl-0 py-3' : 'pl-6 py-3'}
            text-[15px] font-medium transition-all duration-300 cursor-pointer
            ${isActive
              ? 'bg-white text-black rounded-l-[1.5rem] translate-x-4'
              : 'text-white hover:bg-black/10 hover:text-white hover:rounded-l-[1.5rem] hover:translate-x-4 hover:mr-[-1rem]'
            }
          `}
          style={{
            marginRight: isActive ? '-1rem' : '1rem',
            paddingRight: isActive ? '1rem' : '1rem',
            marginLeft: isActive ? '1rem' : '1rem',
            borderRadius: isActive ? '2.5rem 0 0 2.5rem' : '0.75rem',
            minHeight: '34px',
          }}
        >
          {/* Icon Circle */}
          <div className={`
            w-9 h-9 rounded-full flex items-center justify-center shrink-0
            ${isActive ? 'bg-white/0' : 'bg-white/0'}
          `}>
            <Icon
              size={18}
              strokeWidth={2.5}
              className={isActive ? 'text-black' : 'text-white'}
            />
          </div>
          {!collapsed && <span className="tracking-wide">{label}</span>}
        </button>
      </div>
    );
  };

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}

      {/* Mobile toggle */}
      <button
        id="sidebar-toggle"
        onClick={onToggle}
        className="fixed top-4 left-4 z-50 lg:hidden p-2 rounded-lg bg-white border border-gray-200 shadow-sm cursor-pointer"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside
        className={`
          fixed inset-y-0 left-0 z-40 overflow-hidden
          ${collapsed ? 'w-20' : 'w-[20rem]'} bg-[#cd191a]
          flex flex-col shrink-0
          transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <DotField
          className="absolute inset-0 z-0 opacity-40"
          dotRadius={1.5}
          dotSpacing={19}
          bulgeStrength={14}
          glowRadius={6}
          sparkle={false}
          waveAmplitude={0}
          cursorRadius={500}
          cursorForce={0.02}
          bulgeOnly
          gradientFrom="#ffffff"
          gradientTo="#950a1f"
          glowColor="#cd191a"
        />

        {/* Logo */}
        <div className={`relative z-10 pt-8 pb-6 flex items-center gap-3 ${collapsed ? 'justify-center px-2' : 'px-10'}`}>
          <div className={`flex items-center gap-5.5 ${!collapsed ? 'pl-12' : ''} min-w-0`}>
            {collapsed && (
              <div className="w-10 h-10 flex items-center justify-center shrink-0 relative">
                <img src="/logo.png" alt="SinAi logo" className="w-full h-full object-contain" />
              </div>
            )}
            {!collapsed && (
              <div className="flex flex-col">
                <span className="font-regular text-white tracking-tight leading-none drop-shadow-sm" style={{ fontSize: '36px', fontFamily: "'Gwen', serif" }}>SinAi</span>
              </div>
            )}
          </div>

          <button
            id="sidebar-collapse"
            onClick={onCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex items-center justify-center ml-auto w-8 h-8 rounded-lg text-white hover:bg-white/20 transition-colors duration-100 cursor-pointer"
          >
            {collapsed ? <ChevronRight size={20} strokeWidth={2} /> : <ChevronLeft size={20} strokeWidth={2} />}
          </button>
        </div>

        {/* Main navigation */}
        <nav className={`relative z-10 flex-1 min-h-0 overflow-y-auto py-4 space-y-5`}>
          {MAIN_NAV.map(renderNavItem)}
        </nav>

        {/* Upgrade Ad Overlay */}
        {!collapsed && adVisible && (
          <div className="relative z-10 mx-4 mb-2 mt-auto">
            <div
              onClick={() => {
                onSelectTool('plans');
                if (window.innerWidth < 1024) onToggle();
              }}
              className="relative overflow-hidden bg-gradient-to-br from-white/10 to-white/5 border border-white/20 rounded-2xl p-4 cursor-pointer hover:bg-white/20 transition-all duration-300 group shadow-lg"
            >
              {/* Subtle glassmorphism glow */}
              <div className="absolute -inset-2 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setAdVisible(false);
                }}
                className="absolute top-2 right-2 text-white/40 hover:text-white transition-colors p-1 rounded-md"
              >
                <X size={14} strokeWidth={3} />
              </button>

              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center shrink-0 border border-white/20">
                  <Zap size={14} className="text-white" strokeWidth={2.5} />
                </div>
                <h3 className="text-[13px] font-bold text-white tracking-wide">Upgrade to Plus</h3>
              </div>
              <p className="text-[11px] text-white/70 leading-relaxed mb-3">
                Unlock advanced grammar features & unlimited headlines.
              </p>

              <div className="text-[11px] font-bold text-white/90 group-hover:text-white flex items-center gap-1 transition-colors uppercase tracking-wider">
                Explore Plans <ChevronRight size={12} strokeWidth={3} />
              </div>
            </div>
          </div>
        )}

        {/* Bottom section */}
        <div className={`relative z-10 py-4 space-y-2`}>
          {BOTTOM_NAV.map(renderNavItem)}
        </div>

        {/* User profile */}
        <div className={`relative z-10 px-4 pb-6 pt-2`}>
          <button
            id="user-profile-btn"
            onClick={() => setProfileOpen((v) => !v)}
            className={`
              w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3
              px-2 py-2.5 rounded-xl
              hover:bg-white/20 transition-colors duration-100 cursor-pointer
            `}
          >
            <div className="w-10 h-10 rounded-full bg-white/30 flex items-center justify-center shrink-0 border-2 border-white/40">
              <User size={18} className="text-white" />
            </div>
            {!collapsed && (
              <div className="text-left min-w-0 flex flex-col items-start">
                <div className="flex items-center gap-2 w-full">
                  <p className="text-[15px] font-bold text-white truncate max-w-[100px]">Journalist</p>
                  <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
                    Free
                  </span>
                </div>
                <p className="text-[12px] text-white/80 truncate w-full">journalist@sinai.lk</p>
              </div>
            )}
          </button>

          {/* Profile dropdown */}
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setProfileOpen(false)} />
              <div className={`absolute ${collapsed ? 'left-full ml-2' : 'left-4 right-4'} bottom-[6rem] z-50 bg-white rounded-xl shadow-xl py-2 border border-gray-100`}>
                <button
                  id="profile-view-btn"
                  onClick={() => {
                    onSelectTool('profile');
                    setProfileOpen(false);
                    if (window.innerWidth < 1024) onToggle();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-[14px] font-medium text-gray-700 hover:bg-gray-50 hover:text-red-600 cursor-pointer transition-colors"
                >
                  <User size={18} strokeWidth={2} />
                  <span>View Profile</span>
                </button>
                <button
                  id="profile-upgrade-btn"
                  onClick={() => {
                    onSelectTool('plans');
                    setProfileOpen(false);
                    if (window.innerWidth < 1024) onToggle();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-[14px] font-medium text-gray-700 hover:bg-gray-50 hover:text-red-600 cursor-pointer transition-colors"
                >
                  <Zap size={18} strokeWidth={2} />
                  <span>Upgrade Plan</span>
                </button>
                <button
                  id="profile-settings-btn"
                  onClick={() => {
                    onSelectTool('settings');
                    setProfileOpen(false);
                    if (window.innerWidth < 1024) onToggle();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2 text-[14px] font-medium text-gray-700 hover:bg-gray-50 hover:text-red-600 cursor-pointer transition-colors"
                >
                  <Settings size={18} strokeWidth={2} />
                  <span>Settings</span>
                </button>
                <div className="h-px bg-gray-100 my-1 mx-2" />
                <button
                  id="profile-logout-btn"
                  className="w-full flex items-center gap-3 px-4 py-2 text-[14px] font-medium text-red-600 hover:bg-red-50 cursor-pointer transition-colors"
                >
                  <LogOut size={18} strokeWidth={2} />
                  <span>Sign Out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
