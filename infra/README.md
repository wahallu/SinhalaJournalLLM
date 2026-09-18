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

## Load balancing

`infra/loadbalancer/` runs several `backend-api` replicas behind nginx:

```
docker compose -f infra/loadbalancer/docker-compose.yml up --build --scale backend-api=3
```

The API is then on `http://localhost:8080`. nginx uses `least_conn` (a
generation holds its connection for seconds to minutes, so round-robin
balances poorly), keeps upstream connections alive, never buffers the NDJSON
streams, and only retries on another replica when the first could not be
reached at all — never after a timeout, which could run a generation twice.
Each replica is health-checked on `/health/ready`.

On Coolify, Traefik already balances across a resource's replicas, so there
you only raise the replica count. Each container also runs
`WEB_CONCURRENCY` uvicorn workers (default 2, set in the Dockerfile).

What holds across instances, and what does not:

- **Correct everywhere:** anonymous rate limits and plan quotas count rows in
  `request_telemetry`, not memory.
- **Per process, bounded by a TTL:** runtime settings (30s), plans and
  categories (60s), the SinLlama health probe (15s), admin analytics (60s).
  An instance that takes a write updates immediately; the others catch up
  within the TTL.
- **`TRUSTED_PROXY_COUNT`** must equal the number of proxies that append to
  `X-Forwarded-For` in front of the API: 1 for this load balancer alone, one
  more for each CDN or proxy in front of it. Wrong in either direction breaks
  anonymous rate limiting (see `core/rate_limit.py`).

## CDN

Both the web app and the API send cache headers a CDN (Cloudflare, Vercel's
edge, CloudFront) can use as-is. Put it in front and it only needs to honour
origin `Cache-Control`:

| Path | Cache-Control | Why |
|---|---|---|
| web `/assets/*` | `public, max-age=31536000, immutable` | Content-hashed file names; a URL never changes content |
| web fonts/images | `public, max-age=86400, stale-while-revalidate=604800` | Not hashed, so revalidated daily |
| web HTML | `no-cache` | Names the current bundles; must never go stale |
| API `/api/v1/meta` | `public, max-age=30` | Same for every caller |
| API `/api/v1/plans` | `public, max-age=60` | Public catalog |
| everything else under `/api` | `private, no-cache` | Per-user; a shared cache must never store it |

The web build writes `.gz` and `.br` beside every compressible asset; nginx
serves the `.gz` via `gzip_static`. The API gzips JSON over 1 KB itself and
answers repeat GETs carrying a matching `If-None-Match` with `304`.

Do not enable "cache everything" rules on the API hostname: the
`private` default above exists so that per-user responses are never shared.
