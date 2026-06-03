import type { Page } from 'playwright';
import type { Action, Step } from '../schema/action.ts';
import type { ActionResult, ActionStatus } from '../schema/result.ts';
import type { HarnessConfig } from '../../playwright.config.ts';
import { capturePage } from '../screenshots/capture.ts';
import { diffPngs, ScreenshotSizeMismatchError } from '../screenshots/diff.ts';
import {
  deleteIfExists,
  pathsFor,
  readBaseline,
  writePng,
} from '../screenshots/baselineStore.ts';
import { interpolate } from './interpolate.ts';
import { runClick } from './steps/click.ts';
import { runInput } from './steps/input.ts';
import { runIntercept } from './steps/intercept.ts';
import { runNavigate } from './steps/navigate.ts';
import { runScroll } from './steps/scroll.ts';
import { runWaitFor } from './steps/waitFor.ts';

export interface RunActionOptions {
  page: Page;
  action: Action;
  parameters: Record<string, string>;
  rootDir: string;
  storyFile: string;
  config: HarnessConfig;
}

/**
 * Runs every step of an action in order. Fails fast on the first error so the
 * harness never captures a screenshot of a half-finished state. If every step
 * succeeds and `action.screenshot !== false`, captures the page and compares
 * against the committed baseline.
 */
export async function runAction(
  options: RunActionOptions,
): Promise<ActionResult> {
  const { action, page, parameters, rootDir, storyFile, config } = options;
  validateParameters(action, parameters);
  const startedAt = new Date();

  for (let index = 0; index < action.steps.length; index += 1) {
    const step = action.steps[index];
    try {
      await dispatch(page, step, parameters, config);
    } catch (error) {
      const finishedAt = new Date();
      return {
        action: action.action,
        parameters,
        status: 'failed',
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        failedStepIndex: index,
        failureMessage: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (action.screenshot === false) {
    const finishedAt = new Date();
    return {
      action: action.action,
      parameters,
      status: 'pass',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
    };
  }

  return captureAndCompare({
    action,
    page,
    parameters,
    rootDir,
    storyFile,
    startedAt,
  });
}

async function dispatch(
  page: Page,
  step: Step,
  parameters: Record<string, string>,
  config: HarnessConfig,
): Promise<void> {
  switch (step.kind) {
    case 'navigate':
      return runNavigate(page, interpolate(step.path, parameters), config);
    case 'click':
      return runClick(page, step.hint, config.defaultTimeoutMs);
    case 'input':
      return runInput(
        page,
        step.hint,
        interpolate(step.value, parameters),
        config.defaultTimeoutMs,
      );
    case 'scroll':
      return runScroll(page, step.direction, step.amount);
    case 'intercept':
      return runIntercept(page, step.pattern, step.respond, step.method);
    case 'waitFor':
      return runWaitFor(page, step.hint, config.defaultTimeoutMs);
  }
}

interface CaptureOptions {
  action: Action;
  page: Page;
  parameters: Record<string, string>;
  rootDir: string;
  storyFile: string;
  startedAt: Date;
}

async function captureAndCompare(
  options: CaptureOptions,
): Promise<ActionResult> {
  const { action, page, parameters, rootDir, storyFile, startedAt } = options;
  const paths = pathsFor({
    rootDir,
    storyFile,
    actionName: action.action,
  });
  const actualPng = await capturePage(page);
  await writePng(paths.actual, actualPng);

  const baselinePng = await readBaseline(paths.baseline);
  const baseResult: ActionResult = baseResultFor(
    action.action,
    parameters,
    startedAt,
  );

  if (baselinePng === undefined) {
    await writePng(paths.baseline, actualPng);
    return finishResult(baseResult, {
      status: 'new',
      baselinePath: paths.baseline,
      actualPath: paths.actual,
    });
  }

  try {
    const pixelThreshold = action.diff?.pixelThreshold ?? 0.1;
    const maxDiffRatio = action.diff?.maxDiffRatio ?? 0.005;
    const outcome = diffPngs(baselinePng, actualPng, pixelThreshold);
    if (outcome.diffRatio <= maxDiffRatio) {
      await deleteIfExists(paths.diff);
      return finishResult(baseResult, {
        status: 'pass',
        baselinePath: paths.baseline,
        actualPath: paths.actual,
        diffPixels: outcome.diffPixels,
        diffRatio: outcome.diffRatio,
      });
    }
    await writePng(paths.diff, outcome.diffPng);
    return finishResult(baseResult, {
      status: 'changed',
      baselinePath: paths.baseline,
      actualPath: paths.actual,
      diffPath: paths.diff,
      diffPixels: outcome.diffPixels,
      diffRatio: outcome.diffRatio,
    });
  } catch (error) {
    if (error instanceof ScreenshotSizeMismatchError) {
      return finishResult(baseResult, {
        status: 'changed',
        baselinePath: paths.baseline,
        actualPath: paths.actual,
        failureMessage: error.message,
      });
    }
    throw error;
  }
}

function baseResultFor(
  actionName: string,
  parameters: Record<string, string>,
  startedAt: Date,
): ActionResult {
  return {
    action: actionName,
    parameters,
    status: 'pass',
    startedAt: startedAt.toISOString(),
    finishedAt: startedAt.toISOString(),
    durationMs: 0,
  };
}

function finishResult(
  base: ActionResult,
  overrides: Partial<ActionResult> & { status: ActionStatus },
): ActionResult {
  const finishedAt = new Date();
  return {
    ...base,
    ...overrides,
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - new Date(base.startedAt).getTime(),
  };
}

function validateParameters(
  action: Action,
  parameters: Record<string, string>,
): void {
  const declared = new Set(action.parameters ?? []);
  for (const key of Object.keys(parameters)) {
    if (!declared.has(key)) {
      throw new Error(
        `Action "${action.action}" received unknown parameter "${key}"`,
      );
    }
  }
  for (const required of declared) {
    if (parameters[required] === undefined) {
      throw new Error(
        `Action "${action.action}" is missing parameter "${required}"`,
      );
    }
  }
}
