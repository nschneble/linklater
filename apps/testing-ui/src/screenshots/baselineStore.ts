import {
  access,
  copyFile,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';

export interface BaselinePaths {
  baseline: string;
  actual: string;
  diff: string;
}

export interface StoreOptions {
  rootDir: string;
  storyFile: string;
  actionName: string;
}

/**
 * Computes deterministic paths for the baseline (committed), actual
 * (regenerated each run), and diff (regenerated when a baseline existed and
 * the diff was non-zero) PNGs. Centralised so the runner and the CLI's
 * `approve` command agree on layout.
 */
export function pathsFor(options: StoreOptions): BaselinePaths {
  const storySlug = options.storyFile.replace(/\.json$/i, '');
  return {
    baseline: join(options.rootDir, 'baselines', options.actionName, '0.png'),
    actual: join(
      options.rootDir,
      'report',
      'screenshots',
      storySlug,
      `${options.actionName}.actual.png`,
    ),
    diff: join(
      options.rootDir,
      'report',
      'screenshots',
      storySlug,
      `${options.actionName}.diff.png`,
    ),
  };
}

export async function readBaseline(path: string): Promise<Buffer | undefined> {
  try {
    await access(path);
  } catch {
    return undefined;
  }
  return readFile(path);
}

export async function writePng(path: string, png: Buffer): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, png);
}

export async function deleteIfExists(path: string): Promise<void> {
  try {
    await rm(path);
  } catch {
    // file was not there; nothing to do
  }
}

export async function copyToBaseline(
  actualPath: string,
  baselinePath: string,
): Promise<void> {
  await mkdir(dirname(baselinePath), { recursive: true });
  await copyFile(actualPath, baselinePath);
}

/**
 * Turns an absolute screenshot path into a path that is relative to the
 * generated `report/` directory so the HTML report can reference it with a
 * portable `src` attribute.
 */
export function pathRelativeToReport(
  rootDir: string,
  absolute: string,
): string {
  return relative(join(rootDir, 'report'), absolute);
}
