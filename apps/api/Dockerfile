# syntax=docker/dockerfile:1

# NestJS API image. Build context is the repository ROOT (the workspace lockfile
# and both app package.json files live there), so every COPY path below is
# relative to the repo root, not to apps/api.
#
# Three stages:
#   1. builder  — installs all workspace deps, generates the Prisma client,
#                 type-checks, and compiles the API to apps/api/dist.
#   2. proddeps — a clean production-only dependency tree, so the SWC build
#                 toolchain never reaches the runtime image.
#   3. runtime  — a slim image that runs `node dist/main`.
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

# Type-check, then compile the API to apps/api/dist. The SWC builder strips
# types without checking them, so `npm run typecheck` (tsc --noEmit) runs first
# to keep a type-broken image unbuildable; the tag-triggered deploy path builds
# this image directly and does not otherwise run CI's typecheck step. (nest-cli
# sourceRoot=src, tsconfig outDir=./dist → entry is dist/main.js.)
RUN npm run typecheck && npm run build

# ---------------------------------------------------------------------------
# Stage 2: proddeps
# ---------------------------------------------------------------------------
# A production-only dependency tree for the runtime image. `npm ci --omit=dev`
# drops the build toolchain the builder needed but the runtime never runs — the
# SWC builder (@swc/cli and its ~143-package binary-downloader stack, plus
# @swc/core), the Nest CLI, TypeScript, and jest — which would otherwise ship to
# prod for zero runtime benefit if node_modules were copied whole from builder.
#
# Scripts run (NOT --ignore-scripts) on purpose: @prisma/engines' postinstall
# places the native schema engine that `prisma migrate deploy` needs. Same
# manifests as the builder, so the install is lockfile-identical minus the dev
# dependencies.
FROM node:22-slim AS proddeps

WORKDIR /app

# OpenSSL before the install so @prisma/engines' postinstall detects the same
# libssl the runtime carries (openssl 3.x) and downloads the MATCHING native
# schema engine. Without it Prisma cannot detect libssl and falls back to the
# openssl-1.1.x engine variant; then at `prisma migrate deploy` time — where the
# runtime image does have openssl 3.x — Prisma would try to fetch the correct
# variant over the network into a root-owned node_modules, which fails under the
# unprivileged `node` user. Baking the right variant keeps migrate deploy
# self-contained: no deploy-time engine download, no network dependency.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci --omit=dev

# ---------------------------------------------------------------------------
# Stage 3: runtime
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime

ENV NODE_ENV=production

# OpenSSL for the Prisma schema engine used by `prisma migrate deploy`; wget for
# the container HEALTHCHECK. node:22-slim ships neither by default.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# The production dependency tree (from the proddeps stage), the compiled app,
# the workspace manifests, and the Prisma schema plus migrations. node_modules
# comes from proddeps (npm ci --omit=dev), not the builder, so the SWC build
# toolchain never ships to prod. prisma is a runtime dependency, not a
# devDependency: the deploy workflow runs `prisma migrate deploy` against this
# image, so the Prisma CLI and its native schema engine (@prisma/engines) must
# live in the production tree. The Prisma client runtime, @prisma/adapter-pg,
# and pg were already prod deps. See docs/DEPLOYMENT.md's update-deploy flow.
COPY --from=proddeps /app/node_modules ./node_modules
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
