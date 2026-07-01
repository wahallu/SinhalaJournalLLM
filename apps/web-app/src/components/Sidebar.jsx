import { useState } from 'react';
import {
  LayoutDashboard, SpellCheck, Newspaper, PenLine, FileText,
  Menu, X, History, Settings, ChevronLeft, ChevronRight, User, LogOut
} from 'lucide-react';

const MAIN_NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'grammar', label: 'Grammar Checker', icon: SpellCheck },
  { id: 'headlines', label: 'Headline Generator', icon: Newspaper },
  { id: 'rewriter', label: 'Style Rewriter', icon: PenLine },
  { id: 'summarizer', label: 'News Summarizer', icon: FileText },
];

const BOTTOM_NAV = [
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ activeTool, onSelectTool, isOpen, onToggle, collapsed, onCollapse }) {
  const [profileOpen, setProfileOpen] = useState(false);

  const renderNavItem = ({ id, label, icon: Icon }) => {
    const isActive = activeTool === id;
    return (
      <button
        key={id}
        id={`nav-${id}`}
        onClick={() => {
          onSelectTool(id);
          if (window.innerWidth < 1024) onToggle();
        }}
        title={collapsed ? label : undefined}
        className={`
          w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3
          ${collapsed ? 'px-0 py-2.5' : 'px-3 py-2.5'} rounded-lg
          text-[15px] font-medium transition-colors duration-100 cursor-pointer
          ${isActive
            ? 'bg-white/20 text-white'
            : 'text-white/75 hover:bg-white/10 hover:text-white'
          }
        `}
      >
        <Icon size={19} strokeWidth={isActive ? 2.2 : 1.8} />
        {!collapsed && <span>{label}</span>}
      </button>
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
          fixed lg:static inset-y-0 left-0 z-40
          ${collapsed ? 'w-16' : 'w-72'} bg-accent
          flex flex-col shrink-0
          transition-all duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className={`h-16 flex items-center ${collapsed ? 'justify-center' : 'px-5'} border-b border-white/15`}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">S</span>
            </div>
            {!collapsed && <span className="font-bold text-[17px] text-white tracking-tight">SinAi</span>}
          </div>
        </div>

        {/* Main navigation */}
        <nav className={`flex-1 py-4 ${collapsed ? 'px-2' : 'px-3'} space-y-0.5`}>
          {MAIN_NAV.map(renderNavItem)}
        </nav>

        {/* Bottom section */}
        <div className={`border-t border-white/15 py-3 ${collapsed ? 'px-2' : 'px-3'} space-y-0.5`}>
          {BOTTOM_NAV.map(renderNavItem)}

          {/* Collapse toggle — desktop only */}
          <button
            id="sidebar-collapse"
            onClick={onCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`
              w-full hidden lg:flex items-center ${collapsed ? 'justify-center' : ''} gap-3
              ${collapsed ? 'px-0 py-2.5' : 'px-3 py-2.5'} rounded-lg
              text-[15px] font-medium text-white/60 hover:bg-white/10 hover:text-white
              transition-colors duration-100 cursor-pointer
            `}
          >
            {collapsed ? <ChevronRight size={19} strokeWidth={1.8} /> : <ChevronLeft size={19} strokeWidth={1.8} />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>

        {/* User profile */}
        <div className={`relative border-t border-white/15 ${collapsed ? 'px-2 py-3' : 'px-3 py-3'}`}>
          <button
            id="user-profile-btn"
            onClick={() => setProfileOpen((v) => !v)}
            className={`
              w-full flex items-center ${collapsed ? 'justify-center' : ''} gap-3
              ${collapsed ? 'px-0' : 'px-2'} py-2 rounded-lg
              hover:bg-white/10 transition-colors duration-100 cursor-pointer
            `}
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <User size={15} className="text-white" />
            </div>
            {!collapsed && (
              <div className="text-left min-w-0">
                <p className="text-[14px] font-semibold text-white truncate">Journalist</p>
                <p className="text-[12px] text-white/60 truncate">journalist@sinai.lk</p>
              </div>
            )}
          </button>

          {/* Profile dropdown */}
          {profileOpen && (
            <>
              <div className="fixed inset-0 z-50" onClick={() => setProfileOpen(false)} />
              <div className={`absolute ${collapsed ? 'left-full ml-2' : 'left-3 right-3'} bottom-full mb-2 z-50 bg-white rounded-lg border border-gray-200 shadow-lg py-1`}>
                <button
                  id="profile-view-btn"
                  onClick={() => {
                    onSelectTool('profile');
                    setProfileOpen(false);
                    if (window.innerWidth < 1024) onToggle();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[14px] text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  <User size={16} strokeWidth={1.5} />
                  <span>View Profile</span>
                </button>
                <button
                  id="profile-logout-btn"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[14px] text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  <LogOut size={16} strokeWidth={1.5} />
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
