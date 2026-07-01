# Infra

## Local development

```
docker compose -f infra/docker-compose.yml up
```

Brings up Postgres and `backend-api` (with `--reload`) for local work. This
file is dev-only — it does not represent how anything gets deployed.

Copy `.env.example` → `.env` in each app that has one (`apps/backend-api`,
`apps/web-app`) before running. `.env` is gitignored; `.env.example` is not.

## Production (Coolify)

Each app under `apps/` deploys as its own Coolify resource, pointed at that
app's folder as the build base directory — not at the repo root. That keeps
deploys independent: redeploying `chrome-extension` (once it exists) never
touches `backend-api`, and vice versa.

Nothing here yet builds a production image — this repo currently has no
`Dockerfile`. When `backend-api` is ready to deploy, add
`apps/backend-api/Dockerfile` (in that app's own folder, not here) and point
a Coolify application resource at it. Same pattern for any future app that
needs its own image.
