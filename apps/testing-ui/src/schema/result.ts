/**
 * Outcome model. The runner emits a `RunResult` per invocation; the reporter
 * consumes it to render the HTML report. Status values map onto the three
 * outcomes the framework distinguishes:
 *
 * - `pass`  — action succeeded and screenshot matched baseline (or no baseline).
 * - `changed` — action succeeded but screenshot drifted past the threshold.
 *   The story does not fail. The user reviews and either approves the new
 *   baseline or files a bug.
 * - `failed` — a step threw. The story fails fast and skips any later actions.
 */
export type ActionStatus = 'pass' | 'changed' | 'failed' | 'skipped' | 'new';

export interface ActionResult {
  action: string;
  parameters?: Record<string, string>;
  status: ActionStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  /**
   * Number of the step (0-indexed) that failed. Undefined if the action
   * succeeded or was skipped without running.
   */
  failedStepIndex?: number;
  failureMessage?: string;
  baselinePath?: string;
  actualPath?: string;
  diffPath?: string;
  diffPixels?: number;
  diffRatio?: number;
}

export type StoryStatus = 'pass' | 'changed' | 'failed';

export interface StoryResult {
  story: string;
  file: string;
  status: StoryStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  actions: ActionResult[];
}

export interface RunResult {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totals: {
    stories: number;
    passed: number;
    changed: number;
    failed: number;
  };
  stories: StoryResult[];
}
