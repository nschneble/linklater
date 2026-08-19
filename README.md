# Linklater

[![License: CC0-1.0](https://img.shields.io/badge/License-CC0_1.0-lightgrey.svg)](http://creativecommons.org/publicdomain/zero/1.0)

Linklater is an [Instapaper](https://www.instapaper.com)-inspired “read it later” app.

It’s both an homage to [Richard Linklater](https://en.wikipedia.org/wiki/Richard_Linklater) and a ridiculously apt portmanteau.

![Linklater](screenshots/your-links.jpg)

## Who needs this?

Most curious adults come across dozens of interesting articles on any given day. Do they have time to read them all? Nope. Do they often forget about them? Totally.

**Linklater allows these articles to be saved quickly and easily for later reading.**

## Features

As a user, you can:

- Create an account with passwords, magic links, and/or Google or Apple SSO
- Secure your account with two-factor authentication (TOTP + recovery codes)
- Save links in-app or using the handy [bookmarklet](#bookmarklet)
- Search and [stumble!](https://en.wikipedia.org/wiki/StumbleUpon)
- Preview themes based on Richard Linklater's filmography
- Toggle between light and dark mode
- Generate API tokens for third-party integrations
- Delete your account and burn it to the ground

## Screenshots

Click on an image to open it full-size in a new browser tab:

<table>
  <tr>
    <td align="center">
      <a href="screenshots/log-in.jpg">
        <img src="screenshots/log-in-thumbnail.jpg" alt="Log In" />
      </a>
      <br><sub><em>Log In</em></sub>
    </td>
    <td align="center">
      <a href="screenshots/account-settings.jpg">
        <img src="screenshots/account-settings-thumbnail.jpg" alt="Account Settings" />
      </a>
      <br><sub><em>Account Settings</em></sub>
    </td>
    <td align="center">
      <a href="screenshots/light-mode.jpg">
        <img src="screenshots/light-mode-thumbnail.jpg" alt="Themes" />
      </a>
      <br><sub><em>Themes</em></sub>
    </td>
  </tr>
</table>

## Tech stack

- **Front-end**: React + [Vite](https://vite.dev) + [Tailwind](https://tailwindcss.com) + [Font Awesome](https://fontawesome.com)
- **Back-end**: [NestJS](https://nestjs.com)
- **Database**: Prisma + PostgreSQL
- **Authentication**: [Passport](https://www.passportjs.org)
- **Jobs:** [pg-boss](https://timgit.github.io/pg-boss/#/)
- **Linting**: ESLint + Prettier
- **Testing**: Vitest (front-end) + Jest (back-end)

## Monorepo structure

It’s a majestic modular monorepo!

```txt
linklater/
├─ apps/
│  ├─ api/          # NestJS back-end
│  │  └─ README.md  # .env, modules, auth, jobs
│  │
│  └─ web/          # React + Vite front-end
│     └─ README.md  # .env, components, state, API, routes
│
├─ package.json     # root workspace + scripts
└─ README.md
```

## Deployment

Hosting choices and the production deploy flow are documented in [the deployment decision record](docs/DEPLOYMENT.md). In short: pushing a version tag (`vX.Y.Z`) builds the container images, publishes them, and rolls them onto the VPS over SSH.

## Bookmarklet

Linklater includes a one-click bookmarklet that saves the current page directly to your account.

To install, go to **Settings → Bookmarklet** and drag the _Save to Linklater_ button to your bookmarks bar. Your auth token is embedded, so you can immediately click it on any page to save the link.

## Local development

### Prerequisites

- Node 22.x
- PostgreSQL 16
- [Mailpit](https://mailpit.axllent.org/)
- [ShellCheck](https://www.shellcheck.net/) (`brew install shellcheck`), needed by `npm run lint` and `bin/flintest` but not to run the app

### Install dependencies

```bash
# cd /path/to/your/repo
npm install
```

### Set environment variables

You'll need to set the database url, JWT secret, app url, TOTP encryption key, and SMTP values on the back-end, and the API's base url on the front-end for Vite to access.

```bash
# cd /path/to/your/repo

# set DATABASE_URL, JWT_SECRET, APP_URL, TOTP_ENCRYPTION_KEY, SMTP_*
cp apps/api/.env.example apps/api/.env

# set VITE_API_BASE_URL
cp apps/web/.env.example apps/web/.env
```

### Run database migrations

```bash
# cd /path/to/your/repo
bin/migrate
bin/migrate --help
bin/migrate --version

# wipe the database and re-run every migration
bin/migrate --reset
bin/migrate --reset --force

# refuse the wipe instead of asking to confirm it
bin/migrate --reset --no-input

# turn off colored output
bin/migrate --no-color
```

`bin/migrate --reset` wipes the database, so it asks you to type `reset` before it does anything. Any other answer cancels and leaves the database untouched. When there is no terminal to ask on, which is the case in CI, it refuses and exits 66 instead of wiping. Redirecting or piping the output does not count: it still asks on the terminal. `--force` answers the confirmation up front and is how a script gets through. `--no-input` turns the prompt into that same refusal.

`bin/migrate` exits 64 on an unknown flag, 66 on the refusal, and 130 when you answer the confirmation with anything but `reset`. All three `bin/` commands name the closest flag they know when what you typed is a character or two away from a real one.

Run `bin/migrate --help` for the full list of options.

> **Note:** Use `bin/migrate` or `npm run migrate --workspace @linklater/api` instead of calling `npx prisma migrate dev` directly. Prisma 7's `prisma-client` generator requires a custom output path, so `migrate dev` does not automatically regenerate the client.

### Start development server

```bash
# cd /path/to/your/repo
npm run dev

# -OR-

# start the development server TUI
bin/dev
bin/dev --help
bin/dev --version

# turn off colored output
bin/dev --no-color

# report progress one line at a time instead of the TUI
bin/dev --no-input
```

The TUI keys are `0` for status, `1` for API logs, `2` for web logs, `3` for Mailpit logs when Mailpit is installed, `4` for tunnel logs under `--public` when `cloudflared` is installed, and `q` to quit. Control+C and Control+backslash quit too, and pressing Control+C again while the servers are stopping stops them immediately. Quitting stops everything the TUI started, including the processes those servers spawned.

In a log view, `u` and `d` scroll by a screen. A position line above the output reads `lines 41-60 of 137`, and gains `, top`, `, end` or `, all` when you can see an edge. The view keeps up with new output while it sits at the end, and holds still while you are scrolled back.

Logs are kept after the run. Each run gets its own folder under the system temp directory, `$TMPDIR/linklater-dev/<timestamp>-<pid>/`, readable only by you, holding `api.log`, `web.log`, `mailpit.log` and `tunnel.log`. The path prints as the servers stop, so a crash is still there to read once the view is gone. The five newest runs are kept, counting the one currently running, and older ones are deleted at startup. The line by line path below keeps the same logs in the same place, and prints the folder as the servers start as well.

A service that has not reported ready within 90 seconds is marked as failed instead of spinning forever, and its log says what `bin/dev` gave up waiting for. The tunnel gets its own 90 seconds, counted from when it starts, which is after the web server is up.

`bin/dev` reports progress one line at a time instead of showing the TUI when output is redirected, when `TERM` is `dumb` or unset, when there is no controlling terminal, or when you pass `--no-input`. It says which one applied. That path starts the same services under the same options: it sweeps the stale port, starts Mailpit, honours `--remote` and `--public`, keeps the same logs and applies the same 90 second bound.

Its output is append-only, with no cursor movement, no screen clearing and no color under `TERM=dumb`. Server output stays in the log files rather than being interleaved into one stream, so `tail -f` on the printed folder is how you read it live. A service that fails prints the end of its own log. While anything is still starting, a line every 15 seconds names what is being waited on. There are no keys, so Control+C is the only way to stop it, and pressing it again stops the servers immediately.

`bin/dev` exits 64 on an unknown flag, 0 when you quit a healthy run with `q`, and 130 when you stop a healthy run with Control+C or Control+backslash. A run where any service errored exits 1 however you stop it, so Control+C on a run with a failed service exits 1 and not 130. The line by line path uses those same codes, minus the `q` that only the TUI has, and it exits 1 on its own once no server is left running.

Linklater uses `concurrently` to run NestJS on port 3000 and Vite on port 5173. Vite picks a different port when 5173 is taken, and the status view, the LAN URL and the tunnel all follow the port it actually bound. **Open [https://localhost:5173](https://localhost:5173) in your web browser and you're good to go!**

![dev](screenshots/dev.jpg)

### Linting, tests, and CI

Both the front and back-end use ESLint and Prettier. The shell scripts in `bin/` and `scripts/` use ShellCheck. Vitest is used to test the front-end and Jest is used to test the back-end. The commands in `bin/` and the local ESLint rules sit outside both workspaces, so their tests run on Node's own test runner as a third step of `npm run test`. GitHub Actions lint, type-check, and test on pushes and PRs to `main`.

```bash
# cd /path/to/your/repo

npm run format
npm run lint
npm run typecheck
npm run test

# lint the shell scripts on their own
npm run lint:shell

# -OR-

# run the whole quality gate in one TUI
bin/flintest
bin/flintest --help
bin/flintest --version

# run the local visual regression check instead of the default chain
bin/flintest --tuffgal

# turn off colored output, paging, and prompts
bin/flintest --no-color
bin/flintest --no-pager
bin/flintest --no-input
```

`npm run lint:shell` runs ShellCheck over every shell file under `bin/` and `scripts/`, which includes the production backup script and the test shims. Files are picked by their shebang rather than by folder, so the `.mjs` files sitting alongside them are left alone and a new shell script is covered the day it lands. `npm run lint` runs it last, after both workspaces, so it also covers CI and `bin/flintest`. It needs ShellCheck on your `PATH`; without it the command stops and names what to install. CI installs the same version this repo is developed against, since older releases report an indirectly invoked function differently.

`bin/flintest --no-pager` prints failure output in full instead of paging it through `less`. `--no-input` skips the prompt that a `--tuffgal` run ends with.

`bin/flintest` exits 64 on an unknown flag, 1 at the first step that fails, and 130 when you stop it with Control+C. Control+C while failure output is open in the pager leaves the pager rather than the run: the exit code stays the 1 the failed step earned, and the line naming the step still prints.

#### Visual regression tests

Visual + accessibility regression coverage is provided by [Tuffgal](https://www.npmjs.com/package/tuffgal):

- Stories live in `tuffgal/stories/`
- Committed baselines live in `tuffgal/baselines/`, but are written only by CI
- Local `tuffgal/.cache/` holds advisory self-diffs for use during development

`bin/flintest --tuffgal` runs that same local check, opens the HTML report, and then offers to approve any new or changed stories into the local cache. Committed baselines stay CI-only.

```bash
# cd /path/to/your/repo

# one-time setup to create the test database + seed the test user
npm run tuffgal:setup

# run the dev server in test mode + self-diffs current renders against local cache
npm run dev:test
npm run tuffgal

# refresh local cache to accept current renders (does not touch committed baselines)
npm run tuffgal:approve

# forward Tuffgal flags after `--`
npm run tuffgal:approve -- --desktop --new-only  # only new renders + for one breakpoint
npm run tuffgal:approve -- user-logs-in          # single story
```

> **Note:** The `--` is required. Without it `npm` keeps the flags for
> itself instead of forwarding them to `tuffgal approve`.

Updating committed baselines is a PR review step. On a PR, CI captures
Linux renders and reports new, changed, and deleted stories via a sticky
comment plus a candidates artifact. A maintainer with write access comments
`@tuffgal approve` on the PR, and a bot commits the canonical Linux
baselines + `manifest.json` to the branch. No local command writes
committed baselines.

##### Authoring stories

Stories live in `tuffgal/stories/` as JSON files. Each step uses one of
the built-in primitives: `navigate`, `click`, `input`, `scroll`,
`intercept`, `waitFor`, `read`, `type`, `wait`. The `read` step supports
CSS escape hatches (`:focus`, `:has-text()`) for behavioral assertions.

Reference: [npmjs.com/package/tuffgal](https://www.npmjs.com/package/tuffgal)
· [github.com/nschneble/tuffgal](https://github.com/nschneble/tuffgal)

### Git blame

Formatting sweeps (import reordering, comment declutters) touch hundreds of files without changing what the code does, which buries the commit that actually wrote each line. `.git-blame-ignore-revs` at the repo root lists those sweeps so blame skips them.

GitHub's blame view reads the file on its own. Locally it takes one setting, once per clone:

```bash
# cd /path/to/your/repo
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

CI needs no configuration. Nothing in the pipeline runs `git blame`.

Add a commit only when it changes no behavior at all, and give every entry a comment naming it. A line-permutation sweep is provable by comparing the sorted lines of each changed file before and after; a comment-only sweep is provable by compiling both sides with comments stripped and diffing the emit.

### Font Awesome

Font Awesome Free is self-hosted under `public/assets/fontawesome/`. The
shipped `.woff2` files are a subset of what's actually used in the app. The
full webfonts live alongside the build script at
`scripts/font-awesome-source/`.

To add a new icon, add its name (without the `fa-` prefix) to the `solid`
or `brands` array in `scripts/font-awesome-manifest.json`, then run
`npm run subset-fa` and commit the regenerated `.woff2` files.

A vitest in `scripts/font-awesome-manifest.test.ts` enforces the sync
between the manifest and icons referenced in `src/` and `index.html`.

### Versioning

Create a new version in four easy steps!

1. Run the `version:bump` script
2. Update the new CHANGELOG section
3. Create a version tag
4. [Create a new release](https://github.com/nschneble/linklater/releases/new) and paste in the new CHANGELOG section

```bash
# cd /path/to/your/repo
npm run version:bump -- 0.3.0

# create a version tag
git commit -m "Bump version to 0.3.0"
git tag -a v0.3.0 -m "v0.3.0"
git push origin main
git push origin v0.3.0
```

### Advanced

#### Remote access (LAN)

`bin/dev` has a `--remote` option which allows Linklater to be discoverable by other devices on the same Wi-Fi network. It works on both the TUI and the line by line path, and both print the LAN URL once the web server is up.

```bash
# cd /path/to/your/repo
bin/dev --remote

# Linklater is now available on https://linklater.local:5173
```

##### One-time setup for mobile devices

The tech stack uses [mkcert](https://github.com/FiloSottile/mkcert) for HTTPS. Mobile devices need to trust the mkcert root certificate authority, or the connection will be refused.

1. Find the root CA on the computer where Linklater is running:

```bash
mkcert -CAROOT
# ~/Library/Application Support/mkcert
```

2. AirDrop (iOS) or transfer (Android) `rootCA.pem` to your mobile device

3. Install the certificate
   1. **On iOS:** Settings → General → VPN & Device Management. Then enable trust under Settings → General → About → Certificate Trust Settings.
   2. **On Android:** Settings → Security → Install from storage → CA certificate.

##### Set a friendly hostname (optional)

By default the LAN URL uses your Mac's Bonjour hostname.

To get `linklater.local` instead:

```bash
sudo scutil --set LocalHostName linklater
```

This is a one-time system-level change and persists across reboots.

#### Remote access (public)

`bin/dev` has a `--public` option which allows Linklater to be discoverable publicly using a [Cloudflare TryCloudflare tunnel](https://github.com/cloudflare/cloudflared). It works on both the TUI and the line by line path, and both print the tunnel URL.

Install `cloudflared` first with `brew install cloudflared`, or the tunnel row reads `not installed` and key `4` does nothing. The line by line path says `cloudflared` is not installed instead. `--public` turns on `--remote` too, so the app is reachable on the Wi-Fi network as well.

```bash
# cd /path/to/your/repo
bin/dev --public

# Linklater is now available on https://wildly-foxy-rice-pilaf.trycloudflare.com
```

#### Known limitations

- Google and Apple SSO won't work; OAuth callback URLs derive from `API_URL`, which points at localhost
- The bookmarklet generated on the Settings page won't work
