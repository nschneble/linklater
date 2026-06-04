import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, mkdirSync, statSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const TESTING_UI_DIR = join(moduleDir, '..');
const REPO_ROOT = join(TESTING_UI_DIR, '..', '..');
const LOG_DIR = join(TESTING_UI_DIR, 'report');
const HEARTBEAT_PATH = join(TESTING_UI_DIR, '.dev-test-heartbeat');

const API_PORT = 3000;
const WEB_PORT = 5173;

const SIGTERM_GRACE_MS = 5_000;
const HEALTHCHECK_INTERVAL_MS = numberFromEnv(
  'TESTING_UI_HEALTHCHECK_INTERVAL_MS',
  30_000,
);
const IDLE_LIMIT_MS = numberFromEnv(
  'TESTING_UI_DEV_IDLE_LIMIT_MS',
  10 * 60_000,
);
const MAX_RUNTIME_MS = numberFromEnv(
  'TESTING_UI_DEV_MAX_RUNTIME_MS',
  60 * 60_000,
);
const MAX_RESPAWNS = numberFromEnv('TESTING_UI_DEV_MAX_RESPAWNS', 3);

/**
 * Long-running supervisor around `npm run dev:test`. Solves three problems
 * observed during heavy testing-ui iteration:
 *
 *   1. Hot-reload rot — after many nest --watch restarts the API drifts
 *      into a broken state. The supervisor probes both ports and restarts
 *      the whole tree on failure.
 *   2. Forgotten dev servers — supervisor self-terminates after a wall
 *      clock cap (default 60 min) and after an idle window (default 10
 *      min with no heartbeat from `testing-ui run`).
 *   3. Manual signal management — Ctrl-C from the supervisor process kills
 *      the whole child process group, not just the npm wrapper.
 *
 * The heartbeat file (`apps/testing-ui/.dev-test-heartbeat`) is touched by
 * the harness's `runAll` at every invocation. Supervisor reads its mtime
 * every healthcheck. If now - mtime > IDLE_LIMIT_MS, supervisor shuts down.
 */
async function main(): Promise<void> {
  mkdirSync(LOG_DIR, { recursive: true });
  const logPath = join(LOG_DIR, 'dev-servers.log');
  process.stdout.write(
    [
      'Starting dev:test supervisor.',
      `  Log:               ${logPath}`,
      `  Heartbeat:         ${HEARTBEAT_PATH}`,
      `  Healthcheck:       ${HEALTHCHECK_INTERVAL_MS}ms`,
      `  Idle limit:        ${IDLE_LIMIT_MS}ms`,
      `  Max runtime:       ${MAX_RUNTIME_MS}ms`,
      `  Max respawns:      ${MAX_RESPAWNS}`,
      '',
    ].join('\n'),
  );

  const startedAt = Date.now();
  let respawns = 0;
  let child = spawnDevTest(logPath);
  let stopped = false;

  const teardown = async (reason: string): Promise<void> => {
    if (stopped) return;
    stopped = true;
    process.stdout.write(`Supervisor stopping: ${reason}\n`);
    await stopChild(child);
    process.exit(0);
  };

  process.on('SIGINT', () => void teardown('SIGINT received'));
  process.on('SIGTERM', () => void teardown('SIGTERM received'));

  while (!stopped) {
    await sleep(HEALTHCHECK_INTERVAL_MS);
    if (stopped) break;

    if (Date.now() - startedAt > MAX_RUNTIME_MS) {
      await teardown('wall-clock cap reached');
      return;
    }
    if (heartbeatIsStale()) {
      await teardown(`no test:ui activity in ${IDLE_LIMIT_MS}ms`);
      return;
    }

    if (child.exitCode !== null) {
      respawns += 1;
      if (respawns > MAX_RESPAWNS) {
        await teardown(
          `dev:test exited and respawn budget exhausted (${MAX_RESPAWNS})`,
        );
        return;
      }
      process.stdout.write(
        `dev:test exited; respawning (${respawns}/${MAX_RESPAWNS}).\n`,
      );
      child = spawnDevTest(logPath);
      continue;
    }

    const healthy = await probeBothPorts();
    if (!healthy) {
      respawns += 1;
      if (respawns > MAX_RESPAWNS) {
        await teardown(
          `unhealthy ports and respawn budget exhausted (${MAX_RESPAWNS})`,
        );
        return;
      }
      process.stdout.write(
        `Healthcheck failed; killing + respawning (${respawns}/${MAX_RESPAWNS}).\n`,
      );
      await stopChild(child);
      child = spawnDevTest(logPath);
    }
  }
}

function spawnDevTest(logPath: string): ChildProcess {
  const stream = createWriteStream(logPath, { flags: 'a' });
  stream.write(`\n--- dev:test spawned @ ${new Date().toISOString()} ---\n`);
  const child = spawn('npm', ['run', 'dev:test'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  child.stdout?.pipe(stream);
  child.stderr?.pipe(stream);
  return child;
}

async function probeBothPorts(): Promise<boolean> {
  const [api, web] = await Promise.all([
    probePort(API_PORT),
    probePort(WEB_PORT),
  ]);
  return api && web;
}

function probePort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host: 'localhost' });
    const cleanup = (result: boolean): void => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(result);
    };
    socket.once('connect', () => cleanup(true));
    socket.once('error', () => cleanup(false));
    socket.once('timeout', () => cleanup(false));
    socket.setTimeout(2_000);
  });
}

function heartbeatIsStale(): boolean {
  try {
    const stat = statSync(HEARTBEAT_PATH);
    return Date.now() - stat.mtimeMs > IDLE_LIMIT_MS;
  } catch {
    // No heartbeat file yet — count grace period from supervisor start so
    // a fresh shell does not immediately kill itself.
    return false;
  }
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null) return;
  const pid = child.pid;
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      resolve();
    };
    child.once('exit', finish);
    try {
      process.kill(-pid, 'SIGTERM');
    } catch {
      finish();
      return;
    }
    setTimeout(() => {
      if (child.exitCode === null) {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          // Already gone; finish path resolves on the next tick.
        }
      }
    }, SIGTERM_GRACE_MS);
  });
}

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error) => {
  process.stderr.write(
    `supervisor error: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
