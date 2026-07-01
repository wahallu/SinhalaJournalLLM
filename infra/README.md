# Infra

## Local development

```
docker compose -f infra/docker-compose.yml up
```

Brings up `backend-api` (with `--reload`) for local work. This file is
dev-only — it does not represent how anything gets deployed. There's no
local database service here: `backend-api` talks to a self-hosted Supabase
instance (its own Coolify service on the VPS) over Supabase's HTTP API
(PostgREST via the Kong gateway) — not a direct Postgres connection. Set
`PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in
`apps/backend-api/.env` from that service's Coolify page.

Note: that Kong gateway lives inside Coolify's internal Docker network on
the VPS. Reaching it from your local machine (as opposed to from
`backend-api` once it's also deployed on that same VPS) only works if it's
exposed publicly — check the Supabase service's Coolify page for its public
URL/domain. If it isn't exposed, local dev either needs that opened up, or
its own separate dev Supabase project; that's a call to make once you hit
it, not solved here.

Copy `.env.example` → `.env` in each app that has one (`apps/backend-api`,
`apps/web-app`) before running. `.env` is gitignored; `.env.example` is not.

## Production (Coolify)

Each app under `apps/` deploys as its own Coolify resource, pointed at that
app's folder as the build base directory — not at the repo root. That keeps
deploys independent: redeploying `chrome-extension` (once it exists) never
touches `backend-api`, and vice versa.

`apps/backend-api/Dockerfile` and `apps/web-app/Dockerfile` build each
app's production image; Coolify's "Port" setting for a resource is the
container's internal port, unrelated to any host port (including whatever
port the Coolify instance itself runs on).

The database is its own Coolify resource (self-hosted Supabase) — separate
from `backend-api`, deployed and redeployed independently. `backend-api`
reaches it over Supabase's HTTP API via `PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`, ideally over Coolify's internal network rather
than the public internet since they share a server.
