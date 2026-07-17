# Deploying Linklater

This is the end-to-end guide for getting Linklater into production on a single
InterServer VPS: order the box, harden it, tune the stack, ship the first
release, and keep it running. It assumes InterServer as the host and scaling by
adding slices (or a second VPS); the reasoning behind that choice (provider
comparison, RAM sizing math, the reusable tuning patterns) lives in the generic
`VPS-PLAYBOOK.md`, which this guide is the Linklater-specific instance of.

Prices below were checked in July 2026. Treat every dollar figure as "verify
current pricing" before you sign up; providers rename plans and adjust prices
often.

## The app you are deploying

The shape of the thing, derived from the code, because it drives every decision
that follows:

| Piece           | What it is                                                                                                                                                                                                                                                                                                                                                                             |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API             | NestJS HTTP server, listens on port `3000` (`PORT` override). Speaks plain HTTP in production; TLS terminates at the reverse proxy (see the `loadHttpsOptions` docstring in `apps/api/src/main.ts`).                                                                                                                                                                                   |
| Web             | React + Vite static build (`tsc -b && vite build`). Compiles to a folder of static files served by any web server.                                                                                                                                                                                                                                                                     |
| Database        | PostgreSQL. CI pins `postgres:16`; local development uses PostgreSQL 18. The `unaccent` extension is required (accent-insensitive search) and is enabled by a migration, so no manual `CREATE EXTENSION` step is needed on a fresh database.                                                                                                                                           |
| Background jobs | Run **inside the API process** via pg-boss. `QueueService` starts pg-boss on module init and stops it on shutdown (`apps/api/src/queue/queue.service.ts`); recurring jobs (read-link cleanup, RSS suggestions) are registered as pg-boss cron schedules. **There is no separate worker process to deploy or supervise.** pg-boss stores its own state in the same PostgreSQL database. |
| Email           | SMTP, optional. If the `SMTP_*` variables are unset the app runs fine; transactional email (verification, password reset, magic links, deletion) simply does not send.                                                                                                                                                                                                                 |
| Health probe    | `GET /health` is unauthenticated and cheap (a single `SELECT 1`). It returns `200` when the database answers and `503` when it does not, so orchestrators and deploy scripts can gate on it.                                                                                                                                                                                           |
| Migrations      | `npm run migrate:deploy --workspace @linklater/api` runs `prisma migrate deploy && prisma generate`. This is the production-safe, non-interactive migration path.                                                                                                                                                                                                                      |

Two consequences drive everything below:

1. **One process, one database.** The API is a single stateful-ish service (it
   owns the pg-boss workers) plus Postgres. There is no queue broker, no cache
   server, no separate cron container. This is a two-container app plus a static
   site. It fits comfortably on the smallest sensible VPS.
2. **The web build bakes in its API URL.** `VITE_API_BASE_URL` is read at build
   time (`import.meta.env.VITE_API_BASE_URL`), not at runtime. The web image
   must be built with the production API URL, so the same image cannot be
   retargeted to a different API host without a rebuild.

## The architecture

A single virtual machine running Docker Compose with three services: Postgres,
the API, and [Caddy](https://caddyserver.com) as the reverse proxy that serves
the static web build and terminates TLS. Caddy obtains and renews Let's Encrypt
certificates automatically with zero configuration beyond the domain name.

This is fully self-hosted and FOSS end to end (Docker, Postgres, Caddy, Let's
Encrypt), the cheapest option a personal app can actually rely on, and the one
with the lowest exit cost of anything: the whole production definition is a
handful of Compose files and a Postgres dump, so a bad support experience or a
price hike is a one-evening migration rather than a re-platforming project. The
full ranking against managed PaaS, a self-hosted PaaS layer, and a home server
lives in `VPS-PLAYBOOK.md`.

What the implementation ships:

- An API `Dockerfile` (Node 22, runs `node dist/main`). Migrations are **not**
  run by the image entrypoint; the deploy workflow runs them as a separate
  one-shot Compose step before the new API starts.
- A web `Dockerfile` that bakes the static build into the Caddy image, so the
  same service serves the static site and terminates TLS.
- A `docker-compose.prod.yml` wiring Postgres, the API, and the web/proxy
  service together with a healthcheck on `GET /health`.
- A GitHub Actions workflow that builds and publishes both images and deploys
  over SSH.

## Order the box

**Target: InterServer, 2 slices – $6/mo – 1 core / 4 GB RAM / 80 GB SSD / 4 TB
transfer – Secaucus, NJ.** 4 GB is the "don't have to think about it" tier for
this stack; 2 GB is a viable floor with tuning (see the playbook), but at $3/mo
per slice the headroom is cheap insurance.

Direct order link (2 slices, Ubuntu, KVM):

```
https://my.interserver.net/index.php?choice=none.order_vps&platform=kvm&vpsslices=2&coupon=&version=ubuntu
```

What to confirm in the order flow:

| Field         | Choose                        | Why                                                                                                    |
| ------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------ |
| Platform      | **KVM**                       | Real virtualization, not containers. Required for Docker to behave normally.                           |
| Slices        | **2**                         | 1 core / 4 GB / 80 GB SSD / 4 TB transfer. $6/mo.                                                      |
| OS            | **Ubuntu 24.04 LTS**          | Best Docker support, longest support window, most-trodden path.                                        |
| Location      | **Secaucus, NJ** (listed NYC) | InterServer's own datacenter. Their home turf.                                                         |
| Control panel | **None**                      | You are running Compose; a cPanel/DirectAdmin/Webuzo panel is dead weight and an extra attack surface. |

Before you pay:

- Billing is **month to month**. No annual discount, and **no trial or
  money-back guarantee**, per their FAQ. Cancel anytime from the
  panel.
- There is a **99.9% uptime SLA**.
- **Managed support only starts at 8+ slices.** At 2 slices you are on the
  unmanaged tier: support fixes the hypervisor, not your Docker daemon. That is
  what you signed up for.
- You can **add slices later** without rebuilding. Scaling is linear (see
  [Scaling](#scaling)).

**Expect a root password, not an SSH key.** InterServer's flow does not take an
SSH public key at creation. The panel provisions the box and gives you a root
password; you add your key on first login (next section).

## First 20 minutes on the box

SSH in as root with the password from the panel, then do these in order.

### 1. Get your SSH key on, then kill password auth

From **your laptop**:

```bash
ssh-copy-id root@YOUR_SERVER_IP
```

Confirm `ssh root@YOUR_SERVER_IP` works **without** a password prompt before
continuing. If you lock down password auth before your key works, you lock
yourself out and need a console rescue.

Now on the **server**, edit `/etc/ssh/sshd_config`:

```
PermitRootLogin prohibit-password
PasswordAuthentication no
```

```bash
systemctl restart ssh
```

This one step removes the single largest risk to a public box: the root password
is now unguessable because it is unusable.

### 2. Patch and set a hostname

```bash
apt update && apt upgrade -y
hostnamectl set-hostname linklater
```

### 3. Add swap – 2 GB, low swappiness

Not optional, even on 4 GB.

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Make the kernel reluctant to use it
sysctl vm.swappiness=10
echo 'vm.swappiness=10' >> /etc/sysctl.d/99-swap.conf
```

Verify with `free -h`. You should see 2.0Gi of swap, 0B used.

**Read swap correctly:** steady-state usage should sit at ~0. Swap is there to
absorb transient V8 GC spikes that would otherwise trigger the OOM killer. Swap
_actively in use_ under load is a signal to tune or add a slice, not a resource
you are allowed to spend. Under a database workload, active swapping means
iowait and latency spikes.

### 4. Firewall

Caddy needs 80 and 443. You need 22. Nothing else should be reachable. Postgres
in particular must **never** be exposed; it talks to the API over the Compose
network only.

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

> [!WARNING]
> **Docker publishes ports by writing iptables rules that bypass UFW.** A
> `ports:` mapping on your Postgres service would expose it to the internet
> _even with UFW denying everything_. Two defenses, use both:
>
> 1. In `docker-compose.prod.yml`, give Postgres **no `ports:` block at all**.
>    Only Caddy should publish (`80:80`, `443:443`). Services reach each other by
>    Compose service name over the internal network.
> 2. If you ever _do_ need to bind a container port for debugging, bind it to
>    localhost explicitly: `127.0.0.1:5432:5432`, never `5432:5432`.

### 5. Docker

```bash
curl -fsSL https://get.docker.com | sh
docker compose version   # confirm the v2 plugin is present
```

### 6. A deploy user for GitHub Actions

Your Actions workflow SSHes in. Do not let it in as root.

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
mkdir -p /home/deploy/.ssh
# paste the CI public key into /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh && chmod 600 /home/deploy/.ssh/authorized_keys
```

Generate a **dedicated keypair for CI** (not your laptop key), and put the
private half in GitHub Actions secrets as `SSH_PRIVATE_KEY`.

> Membership in the `docker` group is functionally root-equivalent. That is the
> normal trade for Compose-based deploys. You have not reduced privilege so much
> as renamed it. The win is that the key is scoped and revocable without touching
> your root access.

### 7. DNS

Point an `A` record at your VPS IP (and `AAAA` if InterServer gave you IPv6).
**Do this before you start Caddy.** Caddy needs the domain resolving to the box
to complete the Let's Encrypt HTTP-01 challenge. Starting Caddy first just means
failed challenges and, if you retry enough, a Let's Encrypt rate limit.

## Tune the stack for a 4 GB box

Because Postgres is _sharing_ this box with Node, the usual tuning rules that
assume a dedicated database server need adjusting. Three changes: Postgres
config, container memory limits, and connection-pool caps.

### Postgres config

The standard "`shared_buffers` = 25% of RAM" rule assumes a dedicated database
server. At 4 GB shared with Node, 1 GB is a reasonable share.

```conf
max_connections = 50
shared_buffers = 1GB
work_mem = 8MB
maintenance_work_mem = 128MB
effective_cache_size = 2GB       # planner hint only; allocates nothing
max_worker_processes = 4
max_parallel_workers = 4
max_parallel_workers_per_gather = 2
random_page_cost = 1.1           # you are on SSD
```

### Container limits + Node heap cap

```yaml
api:
  deploy:
    resources:
      limits:
        memory: 1G
  environment:
    NODE_OPTIONS: '--max-old-space-size=768'

postgres:
  deploy:
    resources:
      limits:
        memory: 1536M
```

**Why the heap cap matters even at 4 GB:** V8 sizes its default max heap at ~50%
of the container limit, and with _no_ limit set, it sees the whole host. So an
unconstrained Node process on a 4 GB box lets its heap grow toward ~2 GB before
GC gets serious, while competing with Postgres, which it does not know exists.
The cap makes Node's container-awareness work _for_ you instead of against you.
Confirm the limits actually apply under `docker compose up`. Depending on your
Compose version you may need `mem_limit` rather than `deploy.resources.limits`;
use whichever takes effect.

### Connection pools – the pg-boss trap

pg-boss maintains its **own** Postgres pool, separate from Prisma's. Two uncapped
default pools (often 10 each) = 20 backends, and every Postgres connection is a
forked process costing ~5–10 MB. That is 100–200 MB you did not budget for.

Cap both explicitly, comfortably under `max_connections = 50`:

- Prisma: `connection_limit=10` in the `DATABASE_URL` query string
- pg-boss: `max: 5` in the PgBoss factory (`apps/api/src/queue/queue.module.ts`)

Leaves plenty of room for a `psql` session and the one-shot migrate container.

## Required human actions

These are yours to do, once. They involve accounts, secrets, and DNS that
automation should not (and in some cases cannot) perform.

- **Domain and DNS.** Register or reuse a domain and point an `A` record (and
  `AAAA` for IPv6) at the VPS IP. Caddy needs the domain resolving to the box
  before it can obtain a certificate.
- **Production secrets.** Generate real values and store them as GitHub Actions
  secrets (never in the repo). The API refuses to start without the first four:
  - `JWT_SECRET`: a long random string. Sessions are signed with it.
  - `TOTP_ENCRYPTION_KEY`: exactly 64 hexadecimal characters (32 bytes). The app
    hard-validates this format at startup and exits if it is wrong. Generate with
    `openssl rand -hex 32`.
  - `DATABASE_URL`: the connection string for the Postgres container, including a
    strong database password you set (do not ship a default password to
    production). The host is the Compose service name, not `localhost`, because
    the API reaches Postgres over the Compose network:
    `postgresql://USER:PASS@postgres:5432/DB?connection_limit=10`.
  - `APP_URL`: the public origin, for example `https://linklater.example.com`.
    Every transactional email and OAuth redirect embeds this, so an unset or
    wrong value ships dead links to users.
  - `SMTP_*` (optional): host, port, credentials, and from-address if you want
    verification, password-reset, magic-link, and deletion emails to send.
  - `CORS_ORIGIN` (recommended in production): set it to your front-end origin
    (plus any browser-extension origins). It defaults to open `*` for bookmarklet
    support, which you should narrow once the domain is known. **Caveat:**
    narrowing `CORS_ORIGIN` disables the bookmarklet. Bookmarklet requests
    originate from whatever arbitrary third-party page the user is on, never the
    front-end origin, so only `*` admits them; the front-end app and
    browser-extension origins keep working, the bookmarklet does not.
- **SSO callback re-registration.** OAuth callback URLs are pinned to localhost
  in development (the known-limitations note in the top-level `README.md` is
  explicit about this). For production, re-register the callback URLs with each
  SSO provider (Google, Apple) against the real domain, and set the corresponding
  `GOOGLE_*` / `APPLE_*` credentials. Providers are only enabled when their full
  credential set is present, so an un-reconfigured provider is simply off rather
  than broken.

## First deploy

Trigger the deploy workflow once by pushing a version tag (`vX.Y.Z`), which
builds the images and deploys them. The first run creates the database, applies
all migrations (including the one that enables `unaccent`), and brings the stack
up.

Then confirm the box is healthy:

```bash
docker stats --no-stream    # real RSS per container – compare to your limits
free -h                     # swap should read 0B used
curl -I https://YOUR_DOMAIN/api/health   # expect 200
```

`docker stats` is the ground truth. The memory budget is an estimate; your actual
NestJS RSS depends on your dependency tree. If Postgres or Node is sitting close
to its limit at _idle_, raise the limit or add a slice before it becomes a 2 a.m.
problem. `GET /api/health` returns `200` from the public edge because Caddy
proxies only `/api/*` to the API; everything else is the static web app. Finish
by registering an account and running a search.

## Update-deploy flow

A merged pull request reaches production like this:

1. **Cut a version tag.** The deploy workflow builds and publishes images on a
   version-tag push (`v*`), so production is gated on an explicit release rather
   than every merge to `main`. Pushing `vX.Y.Z` builds that commit and deploys
   it.
2. **Build images.** GitHub Actions builds the API image and the web image. The
   web image is built with the production `VITE_API_BASE_URL` baked in, because
   Vite resolves that variable at build time.
3. **Publish to a registry.** Images push to
   [GitHub Container Registry](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
   (`ghcr.io`). The repository is public, so image storage and pulls are free
   under GHCR's current terms (GitHub has stated it will give 30 days' notice
   before charging). Images are tagged with the commit SHA and with `latest`.
4. **Deploy over SSH.** The workflow connects to the VPS, pulls the new images,
   runs database migrations with `migrate:deploy`, then `docker compose up -d` to
   roll the API and web services onto the new images. Order matters: migrate
   before the new code starts, because `prisma migrate deploy` is written to be
   forward-compatible with the currently running version.
5. **Verify.** The workflow polls `GET /api/health` until it returns `200` before
   considering the deploy successful, so a container that comes up but cannot
   reach the database fails the deploy loudly instead of silently serving errors.

### Rollback

Because every image is tagged with its commit SHA, rollback is redeploying the
previous SHA. Run the deploy workflow manually (`workflow_dispatch`) and set the
required `image_tag` input to the prior SHA. The manual dispatch skips the
build-and-push job entirely, so it never rebuilds code or overwrites `:latest`;
it only pulls the image tag you name and rolls the services onto it. The images
are immutable and still in the registry, so no rebuild is needed.

The one asymmetry to respect: application code rolls back instantly, database
migrations do not. A migration that only adds columns or tables is safe to leave
in place while rolling code back (the old code ignores what it does not know
about). A destructive migration is not, which is why the database conventions in
`.claude/CLAUDE.md` push every migration toward the additive,
`NOT VALID`-then-`VALIDATE` shape that Squawk enforces. Keep migrations
backward-compatible and rollback stays a one-command operation.

## Backups

**A scheduled `pg_dump` inside the Compose stack, writing compressed dumps to a
volume, copied offsite, with provider snapshots as an optional second layer.**

- **`pg_dump` over provider snapshots as the primary.** A logical dump is
  portable. It restores onto any Postgres 16 or newer, on any host, which keeps
  the low exit cost intact. Provider block-storage snapshots are convenient but
  provider-shaped and useless the day you change providers. Use them as a bonus,
  not the plan.
- **Where it runs.** A small companion service or a host cron entry runs
  `pg_dump` against the Postgres container on a schedule. Nightly is plenty for a
  personal app; the read-link cleanup job already runs daily, so daily is the
  natural rhythm. Dumps land compressed on a dedicated volume.
- **Offsite copy.** A dump that lives only on the same VM disappears with the VM.
  Sync the dump directory somewhere else (an S3-compatible bucket, or another
  machine) so a lost slice is an inconvenience, not a data-loss event.
- **Retention.** Keep 7 daily dumps and 4 weekly dumps. That covers "I noticed
  the corruption today" and "I noticed it three weeks later" without hoarding.
  Prune older files as part of the same job.
- **Restore test.** A backup you have never restored is a rumor. At least once,
  and after any change to the backup job, restore the latest dump into a
  throwaway database and confirm the app boots against it and search still works.
  Search is the one feature that depends on the `unaccent` extension surviving a
  restore. Write down the restore command next to the backup job so the procedure
  exists before you need it at 2 a.m.

## Scaling

Two axes, and they answer different questions.

**More capacity for Linklater → add slices.** Scaling is linear and does not
require a rebuild: 3 slices ($9/mo) is 6 GB, 4 slices ($12/mo) is 8 GB. Add a
slice from the InterServer panel when `docker stats` shows Postgres or Node
sitting near its limit at idle, or when swap starts seeing active use under load.
After resizing, bump the tuning to match the new ceiling: raise the container
memory limits, `NODE_OPTIONS=--max-old-space-size`, and Postgres `shared_buffers`
proportionally (the 6 GB / 8 GB targets follow the same "share the box, do not
claim all of it" logic as the 4 GB config above).

**More apps → add a VPS, or co-locate.** To run a second app alongside Linklater
you have two options:

- **Co-locate on a bigger box.** Add slices and run the second app as more
  services in the same Compose project (or a second project on the same box),
  with Caddy routing by hostname. Cheapest, but the apps now share a fate (one
  box, one reboot, one blast radius), and you tune memory for the sum.
- **A dedicated VPS per app.** Order a second InterServer VPS and repeat this
  guide. More monthly cost, but full isolation: independent reboots, independent
  blast radius, and each app tuned for its own box. This is the right call once
  an app matters enough that you do not want a noisy neighbor taking it down.

For anything beyond Linklater, the generic `VPS-PLAYBOOK.md` is the reusable
version of this guide: same box setup, same tuning math, stripped of the
Linklater specifics.

## Sources

Pricing and platform state, checked July 2026:

- [InterServer VPS pricing](https://www.interserver.net/vps/) and
  [VPS FAQ](https://www.interserver.net/vps/faq.html)
- [GitHub Container Registry documentation](https://docs.github.com/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [Red Hat – Node.js memory management in containers](https://developers.redhat.com/articles/2025/10/10/nodejs-20-memory-management-containers)
- [PostgreSQL wiki – tuning your server](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server)
- [pg-boss docs](https://timgit.github.io/pg-boss/)
