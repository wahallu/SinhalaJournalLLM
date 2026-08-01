/**
 * Admin shell.
 *
 * The `.admin-theme` class on the outer element is what makes the admin
 * token set resolve; nothing inside it should rely on the user-facing
 * ink/brand tokens, and nothing outside it should use bg-card,
 * text-muted-foreground and friends.
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AdminSidebar from './AdminSidebar';

export default function AdminLayout() {
  const [dark, setDark] = useState(false);

  return (
    <div className={`admin-theme ${dark ? 'dark' : ''} min-h-screen flex bg-background text-foreground`}>
      <AdminSidebar dark={dark} onToggleDark={() => setDark((v) => !v)} />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
