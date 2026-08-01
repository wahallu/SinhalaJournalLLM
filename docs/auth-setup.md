# Auth setup

Everything needed to run SinAi with authentication locally or in a new environment.

## 1. Supabase dashboard

**Authentication → Providers → Email**
- Enable the Email provider
- Enable "Confirm email"

**Authentication → URL Configuration**
- Site URL: `http://localhost:5173` for local dev, your deployed origin in production
- Redirect URLs: add `http://localhost:5173/reset-password` and the deployed equivalent. Password reset silently fails to return the user without this.

**Settings → API** — copy four values:

| Value | Goes to |
|---|---|
| Project URL | `PUBLIC_SUPABASE_URL` (backend), `VITE_SUPABASE_URL` (frontend) |
| `anon` / public key | `SUPABASE_ANON_KEY` (backend), `VITE_SUPABASE_ANON_KEY` (frontend) |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` (backend **only**) |
| JWT Secret | `SUPABASE_JWT_SECRET` (backend) |

The `service_role` key bypasses Row Level Security completely — it can read, edit and delete every row regardless of policy. It must never appear in the frontend bundle, in `.env.example`, or in any committed file.

Newer Supabase projects sign JWTs asymmetrically instead of with a shared secret. If yours has no JWT Secret field, set `SUPABASE_JWKS_URL` to `https://<project>.supabase.co/auth/v1/.well-known/jwks.json` and leave `SUPABASE_JWT_SECRET` empty. The backend tries JWKS first and falls back to HS256.

## 2. Local environment files

```bash
cp apps/backend-api/.env.example apps/backend-api/.env
cp apps/web-app/.env.example      apps/web-app/.env
```

Fill both in. Generate a salt for `IP_HASH_SALT`:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Changing that salt resets every anonymous rate-limit bucket, which is harmless.

**The frontend will not start without `apps/web-app/.env`.** `supabaseClient.js` throws at import when `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing, so the page renders blank with an error in the console. That is deliberate — a client pointed at nothing would fail every auth call with an opaque network error instead.

## 3. Apply the schema

Paste `apps/backend-api/schema.sql` into Supabase Studio's SQL editor and run it. The file is idempotent, so re-running it is safe.

Then verify Row Level Security actually took:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public'
  and tablename in ('grammar_corrections','headline_generations','style_rewrites',
                    'summaries','profiles','user_categories','request_telemetry')
order by tablename;
```

All seven rows must show `rowsecurity = true`. If any shows `false`, per-user isolation is not in force and every guarantee below is void — fix that before going further.

## 4. Create the first admin

Sign up through the app normally, then run `apps/backend-api/scripts/seed_admin.sql` with your email substituted for `REPLACE_WITH_YOUR_EMAIL`.

This step is manual by design. Any in-app path to the first admin role would be a self-promotion hole, and the `guard_profile_privileges` trigger specifically blocks a normal session from changing its own `role`.

## 5. Run it

```bash
cd apps/backend-api && source .venv/bin/activate && uvicorn app.main:app --reload --port 8001
```

```bash
cd apps/web-app && npm run dev
```

The frontend defaults to the hosted backend. To point it at your local one, open Settings in the app and set the API base URL to `http://localhost:8001/api/v1`.

## How auth behaves

| Route group | Auth |
|---|---|
| `/grammar/check`, `/headlines/generate`, `/rewrite`, `/summarize` | optional — anonymous allowed, rate-limited by IP, results not saved |
| `/*/history`, `/history` | required — 401 without a valid token |
| `/meta`, `/health` | none |

Anonymous callers are capped at `ANON_REQUESTS_PER_HOUR` per IP and get 429 past that. The Chrome extension and Docs add-on rely on the anonymous path and keep working unchanged.

A suspended account (`profiles.status = 'suspended'`) is rejected with 403 on every authenticated route, including the ones that otherwise allow anonymous use. Such a user can still use the tools signed out — suspension revokes account privileges, not access to a publicly available tool.

Raw IP addresses are never stored. Only `sha256(ip + IP_HASH_SALT)` is persisted.
