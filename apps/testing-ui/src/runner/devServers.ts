import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, mkdirSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(moduleDir, '..', '..', '..', '..');

const API_PORT = 3000;
const WEB_PORT = 5173;
const READY_TIMEOUT_MS = 120_000;
const SIGTERM_GRACE_MS = 5_000;

export interface ManagedDevServers {
  stop(): Promise<void>;
}

/**
 * Spawns the root `npm run dev:test` script in a new process group, tees its
 * combined output to `report/dev-servers.log`, and waits until both the API
 * (`:3000`) and web (`:5173`) sockets accept connections. Returns a handle
 * whose `stop()` method tears the whole tree down with SIGTERM (graceful)
 * followed by SIGKILL if the children do not exit within the grace window.
 *
 * Used by the CLI's `--manage-servers` flag so CI / one-shell invocations
 * don't need the developer to run `dev:test` in a sibling terminal.
 */
export async function startManagedDevServers(
  testingUiRoot: string,
): Promise<ManagedDevServers> {
  const logsDirectory = join(testingUiRoot, 'report');
  mkdirSync(logsDirectory, { recursive: true });
  const logPath = join(logsDirectory, 'dev-servers.log');
  const logStream = createWriteStream(logPath, { flags: 'w' });

  process.stdout.write(`Spawning dev:test (output → ${logPath})…\n`);
  const child = spawn('npm', ['run', 'dev:test'], {
    cwd: REPO_ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  if (child.stdout) child.stdout.pipe(logStream);
  if (child.stderr) child.stderr.pipe(logStream);

  let earlyExit: Error | undefined;
  child.once('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      earlyExit = new Error(
        `dev:test exited early with code ${code}${signal ? ` (${signal})` : ''}`,
      );
    }
  });

  try {
    await Promise.all([
      waitForPort(API_PORT, READY_TIMEOUT_MS, () => earlyExit),
      waitForPort(WEB_PORT, READY_TIMEOUT_MS, () => earlyExit),
    ]);
  } catch (error) {
    await stopChild(child);
    logStream.end();
    if (earlyExit) throw earlyExit;
    throw error;
  }

  return {
    async stop(): Promise<void> {
      await stopChild(child);
      logStream.end();
    },
  };
}

async function stopChild(child: ChildProcess): Promise<void> {
  if (!child.pid || child.exitCode !== null) {
    return;
  }
  const pid = child.pid;
  process.stdout.write('Stopping dev:test…\n');
  await new Promise<void>((resolve) => {
    let killed = false;
    const finish = (): void => {
      if (killed) return;
      killed = true;
      resolve();
    };
    child.once('exit', finish);
    try {
      // Negative pid targets the entire process group created by detached: true.
      process.kill(-pid, 'SIGTERM');
    } catch {
      // The group might already be gone; treat as resolved.
      finish();
      return;
    }
    setTimeout(() => {
      if (child.exitCode === null) {
        try {
          process.kill(-pid, 'SIGKILL');
        } catch {
          // Already exited or unreachable; finishing is fine either way.
        }
      }
    }, SIGTERM_GRACE_MS);
  });
}

async function waitForPort(
  port: number,
  timeoutMs: number,
  getEarlyExit: () => Error | undefined,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const earlyExit = getEarlyExit();
    if (earlyExit) {
      throw earlyExit;
    }
    const open = await probePort(port);
    if (open) {
      return;
    }
    await sleep(500);
  }
  throw new Error(`Port ${port} did not open within ${timeoutMs}ms`);
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
    socket.setTimeout(1_500);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
