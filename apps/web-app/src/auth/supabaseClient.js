/**
 * Supabase client singleton.
 *
 * The anon key is meant to ship in the browser bundle — it grants nothing on
 * its own, because every table is guarded by Row Level Security. The
 * service-role key must never appear here.
 *
 * Missing config throws at import rather than degrading quietly: a client
 * pointed at nothing would fail every auth call with an opaque network error,
 * which is far harder to diagnose than one loud message at startup.
 */

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Copy apps/web-app/.env.example to apps/web-app/.env and fill both in, then restart the dev server.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export default supabase;
