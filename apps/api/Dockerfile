# syntax=docker/dockerfile:1

# NestJS API image. Build context is the repository ROOT (the workspace lockfile
# and both app package.json files live there), so every COPY path below is
# relative to the repo root, not to apps/api.
#
# Two stages:
#   1. builder  — installs all workspace deps, generates the Prisma client, and
#                 compiles the API to apps/api/dist.
#   2. runtime  — a slim image that runs `node dist/main`.
#
# Node 22 matches the root package.json `engines` pin (`node: >=22`).
#
# Debian slim (glibc) rather than Alpine (musl): the app itself does not need a
# native Prisma query engine — it uses the @prisma/adapter-pg driver adapter and
# the WebAssembly query compiler bundled in @prisma/client, neither of which
# needs OpenSSL. The Prisma *schema* engine (used only by `prisma migrate
# deploy`, which the deploy workflow runs against this image) is a native binary
# that Prisma ships for glibc/OpenSSL targets, so glibc + openssl keeps the
# migrate path working. See docs/DEPLOYMENT.md.

# ---------------------------------------------------------------------------
# Stage 1: builder
# ---------------------------------------------------------------------------
FROM node:22-slim AS builder

WORKDIR /app

# Copy the workspace manifests first so `npm ci` is cached until deps change.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

# Workspace-aware install of every dependency (dev deps included: the Nest CLI
# and Prisma CLI are needed to build). `--ignore-scripts` is deliberately NOT
# used because Prisma's postinstall is required.
RUN npm ci

# Copy only what the API build needs.
COPY apps/api ./apps/api

# Generate the Prisma client BEFORE compiling: the generated client lands in
# apps/api/src/prisma/generated (gitignored, so absent from the build context)
# and `nest build` (tsc) compiles it into dist/. Skip the postinstall marker to
# force a clean generate against the copied schema.
#
# The dummy DATABASE_URL exists only because prisma.config.ts resolves
# env('DATABASE_URL') at config-load time and throws when it is unset;
# `prisma generate` itself never connects. RUN-scoped, so nothing is baked
# into the image — deploy-time `prisma migrate deploy` gets the real URL from
# the Compose environment.
WORKDIR /app/apps/api
RUN DATABASE_URL="postgresql://build:build@build:5432/build" npx prisma generate

# Compile the API to apps/api/dist (nest-cli sourceRoot=src, tsconfig
# outDir=./dist → entry is dist/main.js).
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2: runtime
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime

ENV NODE_ENV=production

# OpenSSL for the Prisma schema engine used by `prisma migrate deploy`; wget for
# the container HEALTHCHECK. node:22-slim ships neither by default.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The compiled app, the installed dependencies (which include the Prisma client
# runtime, @prisma/adapter-pg, pg, and — for the deploy-time migrate step — the
# Prisma CLI and schema engine), the workspace manifests, and the Prisma schema
# plus migrations. node_modules is copied whole rather than reinstalled with
# --omit=dev so the Prisma CLI (a devDependency) stays available for
# `prisma migrate deploy`; see docs/DEPLOYMENT.md's update-deploy flow.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts

# Drop privileges: run as the unprivileged `node` user baked into the image.
USER node

WORKDIR /app/apps/api

EXPOSE 3000

# Poll the unauthenticated /health endpoint. It returns 200 when the database
# answers and 503 otherwise, so an API that comes up but cannot reach Postgres
# is marked unhealthy. PORT overrides the default 3000 (see main.ts).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget --quiet --tries=1 --spider "http://localhost:${PORT:-3000}/health" || exit 1

# `node dist/main` — the compiled entry point. Migrations are run separately by
# the deploy workflow (`prisma migrate deploy`), not on container start, so a
# rolling deploy does not race the schema against still-running old containers.
CMD ["node", "dist/main"]
