import { writeFile } from 'node:fs/promises';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../../playwright.config.ts';
import type { Action } from '../schema/action.ts';
import type { RunResult, StoryResult } from '../schema/result.ts';
import { loadActions, loadStories } from '../schema/load.ts';
import { writeReport } from '../reporter/writeReport.ts';
import { runStory } from './runStory.ts';
import {
  buildSchedule,
  drainSchedule,
  type ScheduledStory,
} from './scheduler.ts';
import {
  startManagedDevServers,
  type ManagedDevServers,
} from './devServers.ts';
import { resetTestDatabase } from './testDb.ts';
import { CoverageCollector } from './coverage.ts';

export interface RunCliOptions {
  storyFilter?: string;
  headed: boolean;
  workers?: number;
  manageServers?: boolean;
  coverage?: boolean;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(moduleDir, '..', '..');
const HEARTBEAT_PATH = join(ROOT_DIR, '.dev-test-heartbeat');

/**
 * Loads every action and story under the package, resets the dedicated test
 * database, schedules stories according to their needs/produces DAG, and
 * drives execution across a fixed worker pool. Returns the aggregate
 * `RunResult` so the CLI can set the process exit code.
 */
export async function runAll(options: RunCliOptions): Promise<RunResult> {
  const startedAt = new Date();
  let managedServers: ManagedDevServers | undefined;
  if (options.manageServers) {
    managedServers = await startManagedDevServers(ROOT_DIR);
  }
  // Heartbeat is the signal the `dev:test:supervised` supervisor reads to
  // decide whether the dev servers are still being used. Touched on every
  // invocation regardless of --manage-servers so a developer who started
  // the supervisor in a sibling shell keeps it alive while iterating.
  await touchHeartbeat();
  const coverage = options.coverage
    ? new CoverageCollector(ROOT_DIR)
    : undefined;
  try {
    process.stdout.write('Resetting test database…\n');
    await resetTestDatabase();
    const actions = await loadActions(ROOT_DIR);
    const allStories = await loadStories(ROOT_DIR);
    const scheduled = buildSchedule(allStories);
    const subset = options.storyFilter
      ? scheduled.filter((item) => matchesFilter(item, options.storyFilter!))
      : scheduled;

    if (options.storyFilter && subset.length === 0) {
      throw new Error(`No story matched filter "${options.storyFilter}"`);
    }

    const workerCount = resolveWorkerCount(options.workers);
    process.stdout.write(
      `Scheduling ${subset.length} stories on ${workerCount} worker${workerCount === 1 ? '' : 's'}.\n`,
    );

    const results = await drainSchedule(
      subset,
      workerCount,
      (item) => runScheduledStory(item, actions, options.headed, coverage),
      (item) => process.stdout.write(`▶ ${item.file}\n`),
      (item, result) =>
        process.stdout.write(
          `  ${result.status.toUpperCase()} ${item.file} (${result.actions.length} actions, ${result.durationMs} ms)\n`,
        ),
    );

    const finishedAt = new Date();
    const runResult: RunResult = {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      totals: summarise(results),
      stories: results,
    };
    const reportPath = await writeReport(ROOT_DIR, runResult);
    process.stdout.write(`\nReport: ${reportPath}\n`);
    if (coverage) {
      const coveragePath = await coverage.generate();
      process.stdout.write(`Coverage: ${coveragePath}\n`);
    }
    return runResult;
  } finally {
    if (managedServers) {
      await managedServers.stop();
    }
  }
}

function runScheduledStory(
  item: ScheduledStory,
  actions: Map<string, Action>,
  headed: boolean,
  coverage: CoverageCollector | undefined,
): Promise<StoryResult> {
  return runStory({
    story: item.story,
    file: item.file,
    needs: item.needs,
    produces: item.produces,
    actions,
    rootDir: ROOT_DIR,
    config,
    headed,
    coverage,
  });
}

function matchesFilter(item: ScheduledStory, filter: string): boolean {
  return (
    item.file === filter ||
    item.file === `${filter}.json` ||
    item.story.story === filter
  );
}

function resolveWorkerCount(requested: number | undefined): number {
  if (requested && requested > 0) {
    return requested;
  }
  const half = Math.floor(cpus().length / 2);
  return Math.max(1, Math.min(half, 4));
}

async function touchHeartbeat(): Promise<void> {
  try {
    await writeFile(HEARTBEAT_PATH, new Date().toISOString(), 'utf8');
  } catch {
    // The heartbeat is opportunistic — a missing parent dir or a disk
    // hiccup should not fail the entire run.
  }
}

function summarise(results: StoryResult[]): RunResult['totals'] {
  return {
    stories: results.length,
    passed: results.filter((result) => result.status === 'pass').length,
    changed: results.filter((result) => result.status === 'changed').length,
    failed: results.filter((result) => result.status === 'failed').length,
  };
}
