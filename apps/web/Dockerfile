# syntax=docker/dockerfile:1

# Web image. Build context is the repository ROOT (the workspace lockfile lives
# there), so COPY paths are relative to the repo root.
#
# Two stages:
#   1. builder — runs `tsc -b && vite build`, producing static files in
#                apps/web/dist.
#   2. runtime — Caddy serving those static files (see docs/DEPLOYMENT.md).
#
# VITE_API_BASE_URL is a BUILD-TIME ARG, not a runtime variable. Vite resolves
# import.meta.env.VITE_API_BASE_URL at build time and bakes it into the bundle,
# so the same image cannot be retargeted to a different API host without a
# rebuild (documented in docs/DEPLOYMENT.md). It defaults to `/api`, the
# same-origin path the production Caddy config reverse-proxies to the API.

# ---------------------------------------------------------------------------
# Stage 1: builder
# ---------------------------------------------------------------------------
FROM node:22-slim AS builder

WORKDIR /app

# Bake the API base URL into the build. `/api` matches the single-domain shape:
# Caddy serves the web app at / and proxies /api/* to the API container.
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

# Bake the SSO login-button toggle into the build. The login page reads
# import.meta.env.VITE_GOOGLE_SSO_ENABLED at build time, so there is no runtime
# switch: the button ships only if this is `true` when the image is built.
# Defaults off; the deploy workflow supplies it from a repository variable so
# it flips on without a code change (see docs/GOOGLE-SSO.md).
ARG VITE_GOOGLE_SSO_ENABLED=false
ENV VITE_GOOGLE_SSO_ENABLED=${VITE_GOOGLE_SSO_ENABLED}

# Workspace manifests first for install-layer caching.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

# patch-package patches must exist before `npm ci` runs the postinstall hook,
# or the install completes with the patches silently unapplied.
COPY patches ./patches

# Workspace-aware install (dev deps included: vite, tailwind, and tsc are all
# devDependencies and required to build).
RUN npm ci

# Copy the web app and compile it to apps/web/dist (Vite's default outDir; not
# overridden in vite.config.ts). The privacy policy lives outside apps/web and
# is bundled into the app (PrivacyPolicyPage imports it with ?raw).
COPY apps/web ./apps/web
COPY docs/PRIVACY.md ./docs/PRIVACY.md
WORKDIR /app/apps/web
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime (Caddy static file server)
# ---------------------------------------------------------------------------
FROM caddy:2-alpine AS runtime

# Serve the compiled SPA. The production Caddyfile at the repo root is the
# reverse proxy + TLS terminator wired up by docker-compose.prod.yml; this
# per-image Caddyfile only serves the static bundle with SPA fallback so the
# image is also runnable on its own.
COPY --from=builder /app/apps/web/dist /srv

# Minimal internal Caddyfile: serve /srv on :80 with single-page-app routing
# (unknown paths fall back to index.html so client-side routes resolve).
RUN printf ':80 {\n\troot * /srv\n\tencode gzip\n\ttry_files {path} /index.html\n\tfile_server\n}\n' > /etc/caddy/Caddyfile

EXPOSE 80

# caddy:2-alpine's default entrypoint runs the Caddyfile at /etc/caddy/Caddyfile.
