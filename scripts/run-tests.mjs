#!/usr/bin/env node
// Routes `npm run test [path...]` to the correct workspace test runner.
//
// - No path: runs the api and web test suites back-to-back (both run even when
//   the first fails), then prints a single consolidated block of failed test
//   files tagged by workspace.
// - Paths under `apps/web/`: runs Vitest against those files in the web workspace.
// - Paths under `apps/api/`: runs Jest against those files in the api workspace.
// - Paths can mix both workspaces; each workspace's runner runs once with all
//   of its matched files.
//
// Jest in apps/api uses `rootDir: "src"`, so we translate the repo-relative
// path into an api/src-relative path before handing it to Jest.
//
// The `eslint-rules/` directory lives at the repo root, outside both
// workspaces, so its specs run on Node's built-in test runner as an extra step
// during a full (no-path) run.

import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..');
const testTargets = process.argv.slice(2);

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

function readFailedFiles(outputPath) {
  if (!existsSync(outputPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(readFileSync(outputPath, 'utf8'));
    if (!Array.isArray(parsed.failed)) {
      return null;
    }
    return parsed.failed;
  } catch {
    return null;
  }
}

function printConsolidatedBlock(workspaceResults) {
  const totalFailedCount = workspaceResults.reduce(
    (count, result) => count + (result.failedFiles?.length ?? 0),
    0,
  );

  const incompleteWorkspaces = workspaceResults.filter(
    (result) => result.failedFiles === null,
  );

  if (totalFailedCount === 0 && incompleteWorkspaces.length === 0) {
    return;
  }

  console.error(`\nFailed test files (${totalFailedCount}):`);
  for (const result of workspaceResults) {
    if (result.failedFiles === null) {
      console.error(`  [${result.label}] (reporter produced no output)`);
      continue;
    }
    for (const filePath of result.failedFiles) {
      console.error(`  [${result.label}] ${filePath}`);
    }
  }
  console.error('');
}

async function runAllWorkspaces() {
  const tempDirectory = mkdtempSync(join(tmpdir(), 'linklater-tests-'));
  const apiOutputPath = join(tempDirectory, 'api.json');
  const webOutputPath = join(tempDirectory, 'web.json');

  try {
    const apiExitCode = await runCommand(
      'npm',
      ['run', 'test', '--workspace', '@linklater/api'],
      { env: { ...process.env, LINKLATER_FAILED_TESTS_OUTPUT: apiOutputPath } },
    );

    const webExitCode = await runCommand(
      'npm',
      ['run', 'test', '--workspace', '@linklater/web'],
      { env: { ...process.env, LINKLATER_FAILED_TESTS_OUTPUT: webOutputPath } },
    );

    const ruleTestsExitCode = await runCommand('node', [
      '--test',
      'eslint-rules/**/*.test.mjs',
    ]);

    printConsolidatedBlock([
      {
        label: 'api',
        pathPrefix: 'apps/api/',
        failedFiles: readFailedFiles(apiOutputPath),
      },
      {
        label: 'web',
        pathPrefix: 'apps/web/',
        failedFiles: readFailedFiles(webOutputPath),
      },
    ]);

    return apiExitCode || webExitCode || ruleTestsExitCode;
  } finally {
    rmSync(tempDirectory, { force: true, recursive: true });
  }
}

function normalizePath(rawPath) {
  // Strip a leading `./` and convert backslashes so Windows-style input works.
  return rawPath.replace(/\\/g, '/').replace(/^\.\//, '');
}

async function runFiles(rawPaths) {
  const webRelativePaths = [];
  const apiRelativePaths = [];

  for (const rawPath of rawPaths) {
    const normalizedPath = normalizePath(rawPath);
    const absolutePath = resolve(repoRoot, normalizedPath);

    if (!existsSync(absolutePath)) {
      console.error(`Test file not found: ${rawPath}`);
      return 1;
    }

    if (normalizedPath.startsWith('apps/web/')) {
      webRelativePaths.push(normalizedPath.slice('apps/web/'.length));
      continue;
    }

    if (normalizedPath.startsWith('apps/api/')) {
      const apiSrcPrefix = 'apps/api/src/';
      if (!normalizedPath.startsWith(apiSrcPrefix)) {
        console.error(
          `API tests must live under apps/api/src/. Received: ${rawPath}`,
        );
        return 1;
      }
      apiRelativePaths.push(normalizedPath.slice(apiSrcPrefix.length));
      continue;
    }

    console.error(
      `Path must start with apps/web/ or apps/api/. Received: ${rawPath}`,
    );
    return 1;
  }

  let exitCode = 0;

  if (apiRelativePaths.length > 0) {
    exitCode ||= await runCommand('npm', [
      'run',
      'test',
      '--workspace',
      '@linklater/api',
      '--',
      ...apiRelativePaths,
    ]);
  }

  if (webRelativePaths.length > 0) {
    exitCode ||= await runCommand('npm', [
      'run',
      'test',
      '--workspace',
      '@linklater/web',
      '--',
      ...webRelativePaths,
    ]);
  }

  return exitCode;
}

const exitCode =
  testTargets.length > 0
    ? await runFiles(testTargets)
    : await runAllWorkspaces();

process.exit(exitCode);
