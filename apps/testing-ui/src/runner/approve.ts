import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyToBaseline } from '../screenshots/baselineStore.ts';
import type { ActionResult, RunResult } from '../schema/result.ts';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(moduleDir, '..', '..');

export interface ApproveOptions {
  storyFilter?: string;
}

export interface ApproveSummary {
  approved: number;
  skipped: number;
}

/**
 * Reads `report/results.json` from the previous run and promotes every
 * `changed` or `new` action's actual screenshot to its baseline. Optional
 * `storyFilter` limits the approval to one story file.
 */
export async function approveAll(
  options: ApproveOptions,
): Promise<ApproveSummary> {
  const resultsPath = join(ROOT_DIR, 'report', 'results.json');
  const raw = await readFile(resultsPath, 'utf8').catch(() => {
    throw new Error(
      `No prior run found at ${resultsPath}. Run \`testing-ui run\` first.`,
    );
  });
  const result = JSON.parse(raw) as RunResult;
  let approved = 0;
  let skipped = 0;
  for (const story of result.stories) {
    if (
      options.storyFilter &&
      story.file !== options.storyFilter &&
      story.file !== `${options.storyFilter}.json`
    ) {
      continue;
    }
    for (const action of story.actions) {
      if (!isApprovable(action)) {
        skipped += 1;
        continue;
      }
      await copyToBaseline(action.actualPath, action.baselinePath);
      approved += 1;
      process.stdout.write(`  approved ${action.action}\n`);
    }
  }
  return { approved, skipped };
}

type ApprovableAction = ActionResult & {
  actualPath: string;
  baselinePath: string;
};

function isApprovable(action: ActionResult): action is ApprovableAction {
  if (action.status !== 'changed' && action.status !== 'new') {
    return false;
  }
  return Boolean(action.actualPath && action.baselinePath);
}
