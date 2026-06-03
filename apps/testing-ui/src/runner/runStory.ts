import { access, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import type { Action } from '../schema/action.ts';
import type { Story } from '../schema/story.ts';
import type {
  ActionResult,
  StoryResult,
  StoryStatus,
} from '../schema/result.ts';
import type { HarnessConfig } from '../../playwright.config.ts';
import { runAction } from './runAction.ts';

export interface RunStoryOptions {
  story: Story;
  file: string;
  actions: Map<string, Action>;
  rootDir: string;
  config: HarnessConfig;
  headed: boolean;
}

const LOGGED_IN_STATE = '.auth/logged-in.json';

/**
 * Drives one story to completion. Launches Chromium, applies the requested
 * storage state, and runs each story step through `runAction`. A failed
 * action skips every later action in the story and the story is marked
 * failed. A `login` action that passes persists its storage state so other
 * stories can opt into the `logged-in` shortcut.
 */
export async function runStory(options: RunStoryOptions): Promise<StoryResult> {
  const startedAt = new Date();
  const browser = await chromium.launch({ headless: !options.headed });
  try {
    return await runStoryWithBrowser(browser, options, startedAt);
  } finally {
    await browser.close();
  }
}

async function runStoryWithBrowser(
  browser: Browser,
  options: RunStoryOptions,
  startedAt: Date,
): Promise<StoryResult> {
  const { story, file, actions, rootDir, config } = options;
  const storageStatePath = await resolveStorageState(
    rootDir,
    story.storageState,
  );
  const context = await browser.newContext({
    baseURL: config.baseUrl,
    viewport: config.viewport,
    storageState: storageStatePath,
    ignoreHTTPSErrors: true,
  });
  context.setDefaultTimeout(config.defaultTimeoutMs);
  const page = await context.newPage();

  const results: ActionResult[] = [];
  let storyStatus: StoryStatus = 'pass';

  for (const storyStep of story.actions) {
    const action = actions.get(storyStep.action);
    if (!action) {
      results.push(skipped(storyStep.action, 'unknown action'));
      storyStatus = 'failed';
      continue;
    }
    if (storyStatus === 'failed') {
      results.push(skipped(storyStep.action, 'earlier action failed'));
      continue;
    }
    const result = await runAction({
      page,
      action,
      parameters: storyStep.parameters ?? {},
      rootDir,
      storyFile: file,
      config,
    });
    results.push(result);
    if (result.status === 'failed') {
      storyStatus = 'failed';
    } else if (result.status === 'changed' || result.status === 'new') {
      if (storyStatus === 'pass') {
        storyStatus = 'changed';
      }
    }
    if (
      action.action === 'login' &&
      (result.status === 'pass' ||
        result.status === 'changed' ||
        result.status === 'new')
    ) {
      await mkdir(join(rootDir, '.auth'), { recursive: true });
      await context.storageState({
        path: join(rootDir, LOGGED_IN_STATE),
      });
    }
  }

  await context.close();
  const finishedAt = new Date();
  return {
    story: story.story,
    file,
    status: storyStatus,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    actions: results,
  };
}

async function resolveStorageState(
  rootDir: string,
  storageState: Story['storageState'],
): Promise<string | undefined> {
  if (storageState !== 'logged-in') {
    return undefined;
  }
  const path = join(rootDir, LOGGED_IN_STATE);
  try {
    await access(path);
  } catch {
    throw new Error(
      `Story requires storageState "logged-in" but ${LOGGED_IN_STATE} is missing. Run a story that uses the "login" action first.`,
    );
  }
  return path;
}

function skipped(actionName: string, reason: string): ActionResult {
  const now = new Date().toISOString();
  return {
    action: actionName,
    status: 'skipped',
    startedAt: now,
    finishedAt: now,
    durationMs: 0,
    failureMessage: reason,
  };
}
