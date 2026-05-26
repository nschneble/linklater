#!/usr/bin/env node
// Routes `npm run test [path]` to the correct workspace test runner.
//
// - No path: runs the api and web test suites back-to-back (default behavior).
// - Path under `apps/web/`: runs Vitest against that file in the web workspace.
// - Path under `apps/api/`: runs Jest against that file in the api workspace.
//
// Jest in apps/api uses `rootDir: "src"`, so we translate the repo-relative
// path into an api/src-relative path before handing it to Jest.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const testTarget = process.argv[2];

function runCommand(command, commandArguments, options = {}) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, commandArguments, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
      ...options,
    });

    child.on('error', rejectPromise);
    child.on('exit', (code, signal) => {
      if (signal) {
        rejectPromise(new Error(`Process killed with signal ${signal}`));
        return;
      }
      resolvePromise(code ?? 0);
    });
  });
}

async function runAllWorkspaces() {
  const apiExitCode = await runCommand('npm', [
    'run',
    'test',
    '--workspace',
    '@linklater/api',
  ]);
  if (apiExitCode !== 0) {
    return apiExitCode;
  }

  return runCommand('npm', [
    'run',
    'test',
    '--workspace',
    '@linklater/web',
  ]);
}

function normalizePath(rawPath) {
  // Strip a leading `./` and convert backslashes so Windows-style input works.
  return rawPath.replace(/\\/g, '/').replace(/^\.\//, '');
}

async function runSingleFile(rawPath) {
  const normalizedPath = normalizePath(rawPath);
  const absolutePath = resolve(repoRoot, normalizedPath);

  if (!existsSync(absolutePath)) {
    console.error(`Test file not found: ${rawPath}`);
    return 1;
  }

  if (normalizedPath.startsWith('apps/web/')) {
    const webRelativePath = normalizedPath.slice('apps/web/'.length);
    return runCommand(
      'npm',
      ['run', 'test', '--workspace', '@linklater/web', '--', webRelativePath],
    );
  }

  if (normalizedPath.startsWith('apps/api/')) {
    const apiSrcPrefix = 'apps/api/src/';
    if (!normalizedPath.startsWith(apiSrcPrefix)) {
      console.error(
        `API tests must live under apps/api/src/. Received: ${rawPath}`,
      );
      return 1;
    }
    const apiRelativePath = normalizedPath.slice(apiSrcPrefix.length);
    return runCommand(
      'npm',
      ['run', 'test', '--workspace', '@linklater/api', '--', apiRelativePath],
    );
  }

  console.error(
    `Path must start with apps/web/ or apps/api/. Received: ${rawPath}`,
  );
  return 1;
}

const exitCode = testTarget
  ? await runSingleFile(testTarget)
  : await runAllWorkspaces();

process.exit(exitCode);
