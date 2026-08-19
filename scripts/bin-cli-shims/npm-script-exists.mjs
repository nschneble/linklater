/**
 * Resolves `npm run <script> [--workspace <name>]` against the package.json it
 * would really have run, and exits non-zero when that script is gone. Renaming
 * a script a bin/ command depends on then fails the command under test instead
 * of passing silently.
 *
 * Invoked by the npm shim through the absolute path of the real node, because
 * PATH itself points at the node shim while a test is running.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const [, scriptName, ...rest] = process.argv.slice(2);

function readPackage(directory) {
  const packagePath = join(directory, 'package.json');
  if (!existsSync(packagePath)) {
    return null;
  }
  return JSON.parse(readFileSync(packagePath, 'utf8'));
}

function findWorkspaceDirectory(workspaceName) {
  const appsRoot = join(repoRoot, 'apps');
  for (const entry of readdirSync(appsRoot)) {
    const candidate = join(appsRoot, entry);
    if (readPackage(candidate)?.name === workspaceName) {
      return candidate;
    }
  }
  return null;
}

const workspaceFlagIndex = rest.indexOf('--workspace');
const workspaceName =
  workspaceFlagIndex === -1 ? null : rest[workspaceFlagIndex + 1];

let packageDirectory = repoRoot;
if (workspaceName !== null && workspaceName !== undefined) {
  packageDirectory = findWorkspaceDirectory(workspaceName);
  if (packageDirectory === null) {
    process.stderr.write(`No workspace named ${workspaceName}\n`);
    process.exit(1);
  }
}

const scripts = readPackage(packageDirectory)?.scripts ?? {};
if (typeof scripts[scriptName] !== 'string') {
  process.stderr.write(
    `Missing script ${scriptName} in ${packageDirectory}/package.json\n`,
  );
  process.exit(1);
}
