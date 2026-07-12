# Deployment

This document decides how Linklater gets hosted in production. It is a decision
record, not a runbook. The Docker Compose files and GitHub Actions workflow that
implement the winning approach ship separately; this explains the "why" so those
files read as obvious rather than arbitrary.

Prices below were checked in July 2026. Treat every dollar figure as "verify
current pricing" before you sign up; providers rename plans and adjust prices
often.

## The app we are deploying

Before ranking hosts, here is the shape of the thing, derived from the code:

| Piece         | What it is                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| API           | NestJS HTTP server, listens on port `3000` (`PORT` override). Speaks plain HTTP in production; TLS terminates at the reverse proxy (see the `loadHttpsOptions` docstring in `apps/api/src/main.ts`). |
| Web           | React + Vite static build (`tsc -b && vite build`). Compiles to a folder of static files served by any web server. |
| Database      | PostgreSQL. CI pins `postgres:16`; local development uses PostgreSQL 18. The `unaccent` extension is required (accent-insensitive search) and is enabled by a migration, so no manual `CREATE EXTENSION` step is needed on a fresh database. |
| Background jobs | Run **inside the API process** via pg-boss. `QueueService` starts pg-boss on module init and stops it on shutdown (`apps/api/src/queue/queue.service.ts`); recurring jobs (read-link cleanup, RSS suggestions) are registered as pg-boss cron schedules. **There is no separate worker process to deploy or supervise.** pg-boss stores its own state in the same PostgreSQL database. |
| Email         | SMTP, optional. If the `SMTP_*` variables are unset the app runs fine; transactional email (verification, password reset, magic links, deletion) simply does not send. |
| Health probe  | `GET /health` is unauthenticated and cheap (a single `SELECT 1`). It returns `200` when the database answers and `503` when it does not, so orchestrators and deploy scripts can gate on it. |
| Migrations    | `npm run migrate:deploy --workspace @linklater/api` runs `prisma migrate deploy && prisma generate`. This is the production-safe, non-interactive migration path. |

Two consequences of this shape drive everything below:

1. **One process, one database.** The API is a single stateful-ish service (it
   owns the pg-boss workers) plus Postgres. There is no queue broker, no cache
   server, no separate cron container. This is a two-container app plus a static
   site. It fits comfortably on the smallest VPS.
2. **The web build bakes in its API URL.** `VITE_API_BASE_URL` is read at build
   time (`import.meta.env.VITE_API_BASE_URL`), not at runtime. The web image
   must be built with the production API URL, so the same image cannot be
   retargeted to a different API host without a rebuild. The implementation
   waves account for this.

## Hosting options, ranked

The project rule (see `.claude/CLAUDE.md`, "Third-Party Integrations") is to
prefer free and open-source, self-hostable infrastructure, and to propose a
design that avoids the dependency when the only path is paid. The maintainer is
a single person running a personal, low-traffic app. That biases hard toward "a
small box I control" over "a platform that controls the box for me."

### 1. Single small VPS + Docker Compose + Caddy (recommended)

One virtual machine from any provider, running Docker Compose with three
services: Postgres, the API, and a reverse proxy that serves the static web
build and terminates TLS. [Caddy](https://caddyserver.com) is the proxy because
it obtains and renews Let's Encrypt certificates automatically with zero
configuration beyond the domain name.

| Aspect        | Detail                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------- |
| Monthly cost  | Roughly $4 to $6. [Hetzner CX22](https://www.hetzner.com/cloud) (2 vCPU, 4 GB, 40 GB, 20 TB traffic) is about $4.59; a [DigitalOcean basic droplet](https://www.digitalocean.com/pricing/droplets) starts at $4. Verify current pricing. |
| Ops burden    | You own the OS. That means occasional `apt upgrade`, watching disk usage, and reading the odd security advisory. For one app on one box this is minutes per month, not hours. |
| Backup story  | `pg_dump` on a cron schedule to a second location (see the backup section). The provider's own snapshots are an optional second layer. |
| TLS story     | Automatic. Caddy fetches and renews Let's Encrypt certificates. You point DNS at the box and never touch a certificate again. |
| Deploy/update | GitHub Actions builds images, pushes to a registry, then SSHes in to pull and restart. Detailed in the update-deploy section. |
| Exit cost     | Lowest of any option. Everything is a Compose file and a Postgres dump. Any Linux box with Docker anywhere runs it. There is no provider-specific glue to unwind. |

This is provider-agnostic on purpose. Hetzner and DigitalOcean are named as
concrete price references, but the setup is "a Linux VM with Docker," which
every VPS provider sells.

### 2. VPS + Coolify or Dokku (self-hosted PaaS layer)

The same VPS, but with a self-hosted platform layer
([Coolify](https://coolify.io) or [Dokku](https://dokku.com)) that adds a web
dashboard, git-push deploys, and managed TLS on top.

| Aspect        | Detail                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Monthly cost  | Same VPS cost, though Coolify wants more RAM (its own docs suggest 2 GB and up), which can push you to a larger instance. |
| Ops burden    | Trades Compose files for a dashboard, but adds a second thing to keep patched and understand when it breaks. You now maintain the app and the PaaS layer. |
| Backup story  | Coolify has built-in scheduled database backups to S3-compatible storage, which is genuinely nice. Dokku leans on plugins. |
| TLS story     | Automatic, same as Caddy underneath. |
| Deploy/update | git push or dashboard button. Pleasant. |
| Exit cost     | Higher than plain Compose. Apps are described in the PaaS layer's own model, so leaving means re-expressing them as Compose or another platform's config. |

For a fleet of apps this convenience earns its keep. For one two-container app,
the platform layer is more moving parts than the app itself. It is a reasonable
second choice, not the pick.

### 3. Managed PaaS (Fly.io, Railway, Render)

Push code, the platform builds and runs it, handles TLS, and offers a managed
Postgres add-on.

| Aspect        | Detail                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Monthly cost  | The generous free tiers are mostly gone as of 2026. [Fly.io](https://fly.io) is usage-based with roughly a $5/month floor for an always-on app. [Railway](https://railway.com) is about $6 to $9/month once a small always-on service plus its Postgres add-on are counted. [Render](https://render.com) is $7/month per always-on web service, and its free web tier spins down after inactivity (a cold start on every first request), which is a poor fit for a "save this link right now" app. Managed Postgres add-ons are billed on top. |
| Ops burden    | Lowest. No OS to patch. |
| Backup story  | Provider-managed, provider-shaped. Good until you want the dump somewhere they do not offer. |
| TLS story     | Automatic. |
| Deploy/update | git push. |
| Exit cost     | Highest. Config lives in provider-specific manifests (`fly.toml` and similar), the database is a provider add-on, and moving off means re-platforming, not copying a Compose file. |

Per the project's FOSS rule, a paid, proprietary platform needs a justification
that a self-hosted design cannot meet. Here it cannot clear that bar: the app is
small enough that self-hosting is genuinely low-effort, the cost is comparable
or higher once the Postgres add-on is counted, and lock-in is strictly worse.
The alternate design that avoids the dependency is option 1, and it wins on cost,
control, and exit.

### 4. Raspberry Pi or home server + Cloudflare Tunnel

Run the same Docker Compose stack on hardware you already own and expose it with
a [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/),
so no public IP or port forwarding is needed.

| Aspect        | Detail                                                                                  |
| ------------- | --------------------------------------------------------------------------------------- |
| Monthly cost  | Effectively zero beyond electricity and the hardware you own. |
| Ops burden    | You are now the datacenter. Power cuts, ISP outages, a dead SD card, and summer heat are all yours to handle. |
| Backup story  | Same `pg_dump`, but the offsite copy matters far more because the "server" lives in your home. |
| TLS story     | Cloudflare terminates TLS at its edge. |
| Deploy/update | Same image-pull flow, reaching the box through the tunnel. |
| Exit cost     | Low in software terms (still just Compose), but you are tied to Cloudflare for ingress. |

Cheapest by a mile and legitimately fun. The reliability floor is a home
internet connection and consumer hardware, which is the wrong trade for an app
whose entire promise is "your reading list is always there." Good as a staging
or personal-experiment target; not the production recommendation.

## Recommendation

**Option 1: a single small VPS running Docker Compose behind Caddy.**

It is the option the project's own rules point at. It is fully self-hosted and
FOSS end to end (Docker, Postgres, Caddy, Let's Encrypt). It is the cheapest
option that a personal app can actually rely on, at roughly $4 to $6/month. It
is provider-agnostic, so a price hike or a bad support experience is a
one-evening migration rather than a re-platforming project. And it has the
lowest exit cost of anything here: the whole production definition is a handful
of Compose files and a Postgres dump.

The implementation waves that follow build exactly this:

- An API `Dockerfile` (Node 22, runs `node dist/main` after `migrate:deploy`).
- A web `Dockerfile` that produces the static build and serves it, with TLS, via
  the proxy.
- A `docker-compose.prod.yml` wiring Postgres, the API, and the web/proxy
  service together with a healthcheck on `GET /health`.
- A GitHub Actions workflow that builds and publishes both images and deploys
  over SSH.

## PostgreSQL backup strategy

**Recommendation: a scheduled `pg_dump` inside the Compose stack, writing
compressed dumps to a volume, copied offsite, with provider snapshots as an
optional second layer.**

The reasoning:

- **`pg_dump` over provider snapshots as the primary.** A logical dump is
  portable. It restores onto any Postgres 16 or newer, on any host, which keeps
  the low exit cost intact. Provider block-storage snapshots are convenient but
  provider-shaped and useless the day you change providers. Use them as a bonus,
  not the plan.
- **Where it runs.** A small companion service or a host cron entry runs
  `pg_dump` against the Postgres container on a schedule (nightly is plenty for
  a personal app; the read-link cleanup job already runs on a daily cadence, so
  daily is the natural rhythm). Dumps land compressed on a dedicated volume.
- **Offsite copy.** A dump that lives only on the same VM disappears with the VM.
  Sync the dump directory to somewhere else (an S3-compatible bucket, or another
  machine) so a lost droplet is an inconvenience, not a data-loss event.
- **Retention.** Keep 7 daily dumps and 4 weekly dumps. That covers "I noticed
  the corruption today" and "I noticed it three weeks later" without hoarding.
  Prune older files as part of the same job.
- **Restore test.** A backup you have never restored is a rumor. At least once,
  and after any change to the backup job, restore the latest dump into a throwaway
  database and confirm the app boots against it and search still works (search is
  the one feature that depends on the `unaccent` extension surviving a
  restore). Write down the restore command next to the backup job so the
  procedure exists before you need it at 2 a.m.

## Update-deploy flow

A merged pull request reaches production like this:

1. **Merge to `main`.** The deploy workflow triggers on push to `main` (or on a
   version tag, if you prefer to gate production on explicit releases).
2. **Build images.** GitHub Actions builds the API image and the web image. The
   web image is built with the production `VITE_API_BASE_URL` baked in, because
   Vite resolves that variable at build time.
3. **Publish to a registry.** Images push to
   [GitHub Container Registry](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
   (`ghcr.io`). The repository is public, so image storage and pulls are free
   under GHCR's current terms (GitHub has stated it will give 30 days' notice
   before charging). Images are tagged with the commit SHA and with `latest`.
4. **Deploy over SSH.** The workflow connects to the VPS, pulls the new images,
   runs database migrations with `migrate:deploy`, then `docker compose up -d`
   to roll the API and web services onto the new images. Order matters: migrate
   before the new code starts, because `prisma migrate deploy` is written to be
   forward-compatible with the currently running version.
5. **Verify.** The workflow polls `GET /health` until it returns `200` before
   considering the deploy successful, so a container that comes up but cannot
   reach the database fails the deploy loudly instead of silently serving errors.

### Rollback

Because every image is tagged with its commit SHA, rollback is redeploying the
previous SHA: point the Compose file at the prior tag and `docker compose up -d`.
The images are immutable and still in the registry, so no rebuild is needed.

The one asymmetry to respect: application code rolls back instantly, database
migrations do not. A migration that only adds columns or tables is safe to leave
in place while rolling code back (the old code ignores what it does not know
about). A destructive migration is not, which is why the database conventions in
`.claude/CLAUDE.md` push every migration toward the additive, `NOT VALID`-then-
`VALIDATE` shape that Squawk enforces. Keep migrations backward-compatible and
rollback stays a one-command operation.

## Required human actions

These are the maintainer's to do, once. They are called out here because they
involve accounts, secrets, and DNS that automation should not (and in some cases
cannot) perform.

- **Provider signup.** Create an account with your chosen VPS provider and
  provision the smallest instance. Add your SSH public key during creation so
  the deploy workflow can reach the box.
- **Domain and DNS.** Register or reuse a domain and point an `A` record (and
  `AAAA` if you want IPv6) at the VPS IP. Caddy needs the domain resolving to the
  box before it can obtain a certificate.
- **Production secrets.** Generate real values and store them as GitHub Actions
  secrets (never in the repo). The API refuses to start without the first four:
  - `JWT_SECRET`: a long random string. Sessions are signed with it.
  - `TOTP_ENCRYPTION_KEY`: exactly 64 hexadecimal characters (32 bytes). The app
    hard-validates this format at startup and exits if it is wrong. Generate with
    `openssl rand -hex 32`.
  - `DATABASE_URL`: the connection string for the Postgres container, including a
    strong database password you set (do not ship a default password to
    production).
  - `APP_URL`: the public origin, for example `https://linklater.example.com`.
    Every transactional email and OAuth redirect embeds this, so an unset or
    wrong value ships dead links to users.
  - `SMTP_*` (optional): host, port, credentials, and from-address if you want
    verification, password-reset, magic-link, and deletion emails to send.
  - `CORS_ORIGIN` (recommended in production): set it to your front-end origin
    (plus any browser-extension origins). It defaults to open `*` for bookmarklet
    support, which you should narrow once the domain is known.
- **SSO callback re-registration.** The known-limitations note in the top-level
  `README.md` is explicit that OAuth callback URLs are pinned to localhost in
  development. For production, re-register the callback URLs with each SSO
  provider (Google, Apple) against the real domain, and set the corresponding
  `GOOGLE_*` / `APPLE_*` credentials. Providers are only enabled when their full
  credential set is present, so an un-reconfigured provider is simply off rather
  than broken.
- **First deploy.** Trigger the deploy workflow once (merge to `main` or run it
  manually). The first run creates the database, applies all migrations
  (including the one that enables `unaccent`), and brings the stack up. Confirm
  `GET /health` returns `200` and that you can register an account and run a
  search.

## Sources

Pricing and platform state, checked July 2026:

- [Hetzner Cloud pricing](https://www.hetzner.com/cloud)
- [DigitalOcean droplet pricing](https://www.digitalocean.com/pricing/droplets)
- [GitHub Container Registry documentation](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Fly.io](https://fly.io), [Railway](https://railway.com), and [Render](https://render.com) pricing pages
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)
</content>
</invoke>
