FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite inlines import.meta.env.* at BUILD time, not container start, so these
# must be present here. Without them the bundle is built against empty values
# and throws during module init — a completely blank page, including for the
# anonymous visitors the four writing tools are meant to serve.
#
# .dockerignore excludes .env deliberately (it holds real values), so they
# arrive as build args:
#
#   docker build \
#     --build-arg VITE_SUPABASE_URL=https://xxx.supabase.co \
#     --build-arg VITE_SUPABASE_ANON_KEY=eyJ... .
#
# The anon key is meant to ship in a browser bundle — Row Level Security is
# what constrains it. Never pass the service-role key here.
# ARG VITE_SUPABASE_URL
# ARG VITE_SUPABASE_ANON_KEY
# ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
# ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

RUN npm run build

# Verify the values actually made it into the bundle, rather than checking
# one particular way of supplying them. Vite reads .env.production from the
# build context when no build arg is set, so a platform that does not pass
# --build-arg (Render, for one) still produces a working image — but an
# image whose bundle has no Supabase URL renders a blank page, so that must
# fail here instead of at a visitor's browser.
# RUN grep -rq "supabase.co" dist/assets/*.js \
#       || (echo "ERROR: built bundle contains no Supabase URL." \
#        && echo "Set apps/web-app/.env.production, or pass --build-arg VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY." \
#        && exit 1)

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
