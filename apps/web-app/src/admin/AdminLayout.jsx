/**
 * Admin shell.
 *
 * The `.admin-theme` class on the outer element overrides the shared design
 * tokens with the admin palette. Those token names also exist on `:root`
 * with SinAi values (see index.css), so using an admin utility outside this
 * tree renders against the wrong palette rather than failing loudly — keep
 * them inside `src/admin/`.
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
