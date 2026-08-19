/**
 * Behavioural tests for the command line scripts in `bin/`.
 *
 * `bin/` lives at the repo root, outside both workspace test runners, so this
 * spec runs on Node's built-in test runner alongside `eslint-rules/` and is
 * wired into `scripts/run-tests.mjs` so it executes on every `npm run test`.
 *
 * Every run puts `scripts/bin-cli-shims` at the front of PATH, so `npm`, `node`
 * and `npx` record what they were asked to do and then return without doing it.
 * Nothing here installs, migrates, wipes a database or binds a port. The npm
 * shim still resolves `run <script>` against the real package.json, so renaming
 * a script one of these commands depends on fails the run rather than passing
 * unnoticed.
 *
 * Two areas are deliberately out of reach. Anything needing a pseudo-terminal
 * (the confirmation prompt, signal handling, the status view itself) is not
 * covered, and neither is the risk these commands actually carry: `bin/dev`
 * greps other people's startup banners, so a NestJS or Vite release that
 * rewords one breaks it without touching this repo. A fixture of those banners
 * would pin our own text rather than theirs, which is why there isn't one.
 */

import {
  accessSync,
  constants,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { after, describe, it } from 'node:test';
import { deepStrictEqual, match, ok, strictEqual } from 'node:assert/strict';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const repoRoot = resolve(import.meta.dirname, '..');
const shimDirectory = join(import.meta.dirname, 'bin-cli-shims');
const captureRoot = mkdtempSync(join(tmpdir(), 'linklater-bin-cli-'));
const escapeSequence = /\x1b\[/;

const baseEnvironment = { ...process.env };
delete baseEnvironment.NO_COLOR;

const spawnOptions = {
  cwd: repoRoot,
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe'],
  timeout: 60_000,
};

let captureCount = 0;

after(() => rmSync(captureRoot, { force: true, recursive: true }));

function buildEnvironment(extraEnvironment) {
  captureCount += 1;
  const capturePath = join(captureRoot, `invocations-${captureCount}.tsv`);
  writeFileSync(capturePath, '');

  const environment = {
    ...baseEnvironment,
    PATH: `${shimDirectory}:${baseEnvironment.PATH}`,
    BIN_TEST_SHIM_DIR: shimDirectory,
    BIN_TEST_CAPTURE: capturePath,
    BIN_TEST_REAL_NODE: process.execPath,
    TERM: 'xterm-256color',
    PORT: '39217',
    ...extraEnvironment,
  };

  ok(environment.PATH.startsWith(`${shimDirectory}:`), 'shims must lead PATH');
  accessSync(join(shimDirectory, 'npm'), constants.X_OK);

  return { capturePath, environment };
}

function readInvocations(capturePath) {
  return readFileSync(capturePath, 'utf8')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => line.split('\t'));
}

function runBin(commandName, commandArguments = [], extraEnvironment = {}) {
  const { capturePath, environment } = buildEnvironment(extraEnvironment);
  const result = spawnSync(
    join(repoRoot, 'bin', commandName),
    commandArguments,
    { ...spawnOptions, env: environment },
  );

  return {
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    invocations: readInvocations(capturePath),
  };
}

function resolveOnPath(commandName) {
  const { environment } = buildEnvironment({});
  const result = spawnSync('bash', ['-c', `command -v ${commandName}`], {
    ...spawnOptions,
    env: environment,
  });
  return result.stdout.trim();
}

function documentedChains(helpText) {
  const chains = [];
  let current = [];

  for (const line of helpText.split('\n')) {
    if (/^\s{2,}(npm|npx|node)\s/.test(line)) {
      current.push(line.trim().split(/\s+/));
      continue;
    }
    if (current.length > 0) {
      chains.push(current);
      current = [];
    }
  }

  return current.length > 0 ? [...chains, current] : chains;
}

function readScripts(packageDirectory) {
  const packagePath = join(repoRoot, packageDirectory, 'package.json');
  return JSON.parse(readFileSync(packagePath, 'utf8')).scripts;
}

const terminalReachable =
  spawnSync('bash', ['-c', ': 2>/dev/null > /dev/tty'], {
    ...spawnOptions,
    env: baseEnvironment,
  }).status === 0;

describe('the bin test harness', () => {
  it('finds the shims ahead of the real commands on PATH', () => {
    for (const commandName of ['npm', 'node', 'npx', 'lsof']) {
      strictEqual(resolveOnPath(commandName), join(shimDirectory, commandName));
    }
  });
});

describe('bin/migrate', () => {
  it('resets through an api script that does not stop to ask', () => {
    const { exitCode, invocations } = runBin('migrate', ['--reset', '--force']);

    strictEqual(exitCode, 0);
    strictEqual(invocations.length, 1);

    const [command, subcommand, target, workspaceFlag, workspace] =
      invocations[0];
    strictEqual(command, 'npm');
    strictEqual(subcommand, 'run');
    strictEqual(workspaceFlag, '--workspace');
    strictEqual(workspace, '@linklater/api');

    const body = readScripts('apps/api')[target];
    ok(body, `apps/api has no ${target} script`);
    match(body, /\bmigrate reset\b/);
    // the target name alone passes on a body that still waits for an answer
    match(body, /--force/);
  });

  it('refuses to reset when --no-input is passed', () => {
    const { exitCode, stderr, invocations } = runBin('migrate', [
      '--reset',
      '--no-input',
    ]);

    strictEqual(exitCode, 66);
    match(stderr, /Refusing to reset the database without confirmation/);
    deepStrictEqual(invocations, []);
  });

  it(
    'refuses to reset when there is no terminal to ask on',
    {
      skip: terminalReachable
        ? 'a terminal is reachable, so this run would ask instead of refusing'
        : false,
    },
    () => {
      const { exitCode, stderr, invocations } = runBin('migrate', ['--reset']);

      strictEqual(exitCode, 66);
      match(stderr, /Refusing to reset the database without confirmation/);
      deepStrictEqual(invocations, []);
    },
  );
});

describe('bin/flintest', () => {
  it('runs the chain its help text lists', () => {
    const [documentedChain] = documentedChains(
      runBin('flintest', ['--help']).stdout,
    );
    const { exitCode, stdout, invocations } = runBin('flintest', [
      '--no-input',
    ]);

    strictEqual(exitCode, 0);
    deepStrictEqual(invocations, documentedChain);
    match(stdout, /All checks passed\./);
  });

  it('runs the visual regression chain its help text lists', () => {
    const [, documentedChain] = documentedChains(
      runBin('flintest', ['--help']).stdout,
    );
    const { exitCode, invocations } = runBin('flintest', [
      '--tuffgal',
      '--no-input',
    ]);

    strictEqual(exitCode, 0);
    // the summary reads results.json through node -e, a probe and not a step
    const steps = invocations.filter((invocation) => invocation[1] !== '-e');
    deepStrictEqual(steps, documentedChain);
  });

  it('stops at the first failing step and names it', () => {
    const { exitCode, stderr, invocations } = runBin(
      'flintest',
      ['--no-input'],
      {
        BIN_TEST_FAIL_SCRIPT: 'lint',
      },
    );
    const commands = invocations.map((invocation) => invocation.join(' '));

    strictEqual(exitCode, 1);
    match(stderr, /Lint failed\./);
    match(stderr, /the lint script was told to fail/);
    ok(commands.includes('npm run lint'));
    ok(!commands.includes('npm run typecheck'));
  });
});

describe('bin/dev', () => {
  it('runs npm run dev when the status view is turned off', () => {
    const { exitCode, stderr, invocations } = runBin('dev', ['--no-input']);

    strictEqual(exitCode, 0);
    match(stderr, /Not starting the status view: --no-input was passed\./);
    match(stderr, /Running npm run dev, which starts the API and web servers/);
    match(stderr, /Skipped: the stale port check and Mailpit\./);
    deepStrictEqual(invocations, [['npm', 'run', 'dev']]);
  });

  it('runs npm run dev when output is redirected', () => {
    const { exitCode, stderr, invocations } = runBin('dev');

    strictEqual(exitCode, 0);
    match(stderr, /Not starting the status view: output is being redirected\./);
    deepStrictEqual(invocations, [['npm', 'run', 'dev']]);
  });

  it('names the remote access the fallback drops', () => {
    const publicRun = runBin('dev', ['--no-input', '--public']);
    const remoteRun = runBin('dev', ['--no-input', '--remote']);

    match(publicRun.stderr, /Skipped: --public, so no Cloudflare tunnel/);
    match(remoteRun.stderr, /Skipped: --remote, so no access from other/);
  });
});

describe('colored output', () => {
  const silentCases = [
    ['--no-color is passed', ['--reset', '--force', '--no-color'], {}],
    ['NO_COLOR is set', ['--reset', '--force'], { NO_COLOR: '1' }],
    ['TERM is dumb', ['--reset', '--force'], { TERM: 'dumb' }],
    ['output is piped', ['--reset', '--force'], {}],
  ];

  for (const [condition, commandArguments, extraEnvironment] of silentCases) {
    it(`prints no escape sequences when ${condition}`, () => {
      const { stdout, stderr } = runBin(
        'migrate',
        commandArguments,
        extraEnvironment,
      );

      ok(!escapeSequence.test(stdout), `stdout was colored: ${stdout}`);
      ok(!escapeSequence.test(stderr), `stderr was colored: ${stderr}`);
    });
  }

  // read from the library because printed color is gated on a real terminal too
  function probeColorVariable(useColor, extraEnvironment = {}) {
    const script =
      '. "$1/lib/cli.sh"; resolve_color "$2"; printf %s "$TTY_BOLD"';
    const result = spawnSync(
      'bash',
      ['-c', script, 'color-probe', join(repoRoot, 'bin'), useColor],
      {
        ...spawnOptions,
        env: {
          ...baseEnvironment,
          TERM: 'xterm-256color',
          ...extraEnvironment,
        },
      },
    );

    strictEqual(result.status, 0);
    return result.stdout;
  }

  it('sets the color variables when nothing turns color off', () => {
    match(probeColorVariable('true'), escapeSequence);
  });

  it('leaves the color variables empty when color is turned off', () => {
    strictEqual(probeColorVariable('false'), '');
    strictEqual(probeColorVariable('true', { NO_COLOR: '1' }), '');
    strictEqual(probeColorVariable('true', { TERM: 'dumb' }), '');
  });
});
