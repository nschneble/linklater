import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../../playwright.config.ts';
import type { RunResult } from '../schema/result.ts';
import { loadActions, loadStories } from '../schema/load.ts';
import { writeReport } from '../reporter/writeReport.ts';
import { runStory } from './runStory.ts';

export interface RunCliOptions {
  storyFilter?: string;
  headed: boolean;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(moduleDir, '..', '..');

/**
 * Loads every action and story under the package, executes each story
 * sequentially (parallelism is a v2 concern — keep the failure log readable),
 * and emits the HTML report. Returns the aggregate `RunResult` so the CLI
 * caller can set the process exit code based on whether any story failed.
 */
export async function runAll(options: RunCliOptions): Promise<RunResult> {
  const startedAt = new Date();
  const actions = await loadActions(ROOT_DIR);
  const allStories = await loadStories(ROOT_DIR);
  const stories = options.storyFilter
    ? allStories.filter(
        ({ file, story }) =>
          file === options.storyFilter ||
          file === `${options.storyFilter}.json` ||
          story.story === options.storyFilter,
      )
    : allStories;

  if (options.storyFilter && stories.length === 0) {
    throw new Error(`No story matched filter "${options.storyFilter}"`);
  }

  const results = [];
  for (const { story, file } of stories) {
    process.stdout.write(`▶ ${file}\n`);
    const storyResult = await runStory({
      story,
      file,
      actions,
      rootDir: ROOT_DIR,
      config,
      headed: options.headed,
    });
    process.stdout.write(
      `  ${storyResult.status.toUpperCase()} (${storyResult.actions.length} actions, ${storyResult.durationMs} ms)\n`,
    );
    results.push(storyResult);
  }

  const finishedAt = new Date();
  const totals = {
    stories: results.length,
    passed: results.filter((result) => result.status === 'pass').length,
    changed: results.filter((result) => result.status === 'changed').length,
    failed: results.filter((result) => result.status === 'failed').length,
  };
  const runResult: RunResult = {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    totals,
    stories: results,
  };
  const reportPath = await writeReport(ROOT_DIR, runResult);
  process.stdout.write(`\nReport: ${reportPath}\n`);
  return runResult;
}
