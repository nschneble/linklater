import { relative } from 'node:path';
import type { ActionResult, RunResult, StoryResult } from '../schema/result.ts';

const STATUS_LABELS: Record<ActionResult['status'], string> = {
  pass: 'Pass',
  changed: 'Changed',
  failed: 'Failed',
  skipped: 'Skipped',
  new: 'New baseline',
};

/**
 * Renders a static HTML report from a `RunResult`. No client framework — the
 * page is a flat document with a tiny script that wires up the
 * baseline/actual/diff tabs on each action card. Screenshot paths are
 * rewritten to be relative to the `report/` directory so the file works when
 * the user double-clicks it.
 */
export function renderReport(result: RunResult, rootDir: string): string {
  const summary = renderSummary(result);
  const stories = result.stories.map((story, index) =>
    renderStory(story, index, rootDir),
  );
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>testing-ui report — Linklater</title>
<link rel="stylesheet" href="assets/report.css" />
</head>
<body>
<header class="report-header">
  <h1>Linklater testing-ui report</h1>
  <p class="report-meta">
    Run finished <time datetime="${result.finishedAt}">${formatDate(result.finishedAt)}</time>
    · Duration ${formatDuration(result.durationMs)}
  </p>
</header>
<main id="main" tabindex="-1">
  <section aria-labelledby="summary-heading" class="summary">
    <h2 id="summary-heading">Summary</h2>
    ${summary}
  </section>
  <section aria-labelledby="stories-heading">
    <h2 id="stories-heading">Stories</h2>
    ${stories.join('\n')}
  </section>
</main>
<script src="assets/report.js"></script>
</body>
</html>
`;
}

function renderSummary(result: RunResult): string {
  return `
    <ul class="summary-list">
      <li><strong>${result.totals.stories}</strong> stories</li>
      <li class="badge badge-pass"><strong>${result.totals.passed}</strong> passed</li>
      <li class="badge badge-changed"><strong>${result.totals.changed}</strong> changed</li>
      <li class="badge badge-failed"><strong>${result.totals.failed}</strong> failed</li>
    </ul>`;
}

function renderStory(
  story: StoryResult,
  storyIndex: number,
  rootDir: string,
): string {
  const actions = story.actions
    .map((action, actionIndex) =>
      renderAction(action, `s${storyIndex}-a${actionIndex}`, rootDir),
    )
    .join('\n');
  return `
    <article class="story" data-status="${story.status}">
      <header class="story-header">
        <h3>${escapeHtml(story.story)}</h3>
        <p class="story-meta">
          <span class="badge badge-${story.status}">${STATUS_LABELS[story.status]}</span>
          <code>${escapeHtml(story.file)}</code>
          · ${formatDuration(story.durationMs)}
        </p>
      </header>
      <ol class="action-list">
        ${actions}
      </ol>
    </article>`;
}

function renderAction(
  action: ActionResult,
  actionId: string,
  rootDir: string,
): string {
  const status = action.status;
  const screenshots = renderScreenshots(action, actionId, rootDir);
  const failure =
    status === 'failed'
      ? `<p class="action-error">
          Step ${(action.failedStepIndex ?? 0) + 1} failed: ${escapeHtml(action.failureMessage ?? 'unknown error')}
        </p>`
      : '';
  const parameters =
    action.parameters && Object.keys(action.parameters).length > 0
      ? `<dl class="action-parameters">
          ${Object.entries(action.parameters)
            .map(
              ([key, value]) =>
                `<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>`,
            )
            .join('')}
        </dl>`
      : '';
  return `
    <li class="action" data-status="${status}">
      <div class="action-head">
        <h4>${escapeHtml(action.action)}</h4>
        <span class="badge badge-${status}">${STATUS_LABELS[status]}</span>
        <span class="action-duration">${formatDuration(action.durationMs)}</span>
      </div>
      ${parameters}
      ${failure}
      ${screenshots}
    </li>`;
}

function renderScreenshots(
  action: ActionResult,
  actionId: string,
  rootDir: string,
): string {
  if (!action.actualPath && !action.baselinePath) {
    return '';
  }
  const baseline = action.baselinePath
    ? toReportRelative(rootDir, action.baselinePath)
    : undefined;
  const actual = action.actualPath
    ? toReportRelative(rootDir, action.actualPath)
    : undefined;
  const diff = action.diffPath
    ? toReportRelative(rootDir, action.diffPath)
    : undefined;
  const diffStatsId = `${actionId}-diff-stats`;
  const ratio =
    action.diffRatio !== undefined
      ? `<p class="diff-stats" id="${diffStatsId}">${action.diffPixels} pixels differ (${(action.diffRatio * 100).toFixed(3)}%)</p>`
      : '';
  return `
    <div class="screenshots" data-default-tab="${diff ? 'diff' : 'actual'}">
      <div class="screenshot-tabs" role="tablist" aria-label="Screenshot view">
        ${tabButton(actionId, 'baseline', 'Baseline', baseline === undefined)}
        ${tabButton(actionId, 'actual', 'Actual', actual === undefined)}
        ${tabButton(actionId, 'diff', 'Diff', diff === undefined)}
      </div>
      ${tabPanel(actionId, 'baseline', baseline, `${action.action} baseline screenshot`)}
      ${tabPanel(actionId, 'actual', actual, `${action.action} actual screenshot from this run`)}
      ${tabPanel(actionId, 'diff', diff, `Pixel diff overlay for ${action.action}: red pixels mark changed regions`, action.diffRatio !== undefined ? diffStatsId : undefined)}
    </div>
    ${ratio}`;
}

function tabButton(
  actionId: string,
  name: string,
  label: string,
  disabled: boolean,
): string {
  return `<button
    type="button"
    role="tab"
    tabindex="-1"
    data-tab="${name}"
    aria-controls="panel-${actionId}-${name}"
    ${disabled ? 'aria-disabled="true"' : ''}
  >${label}</button>`;
}

function tabPanel(
  actionId: string,
  name: string,
  src: string | undefined,
  alt: string,
  describedById?: string,
): string {
  return `<div
    class="screenshot-panel"
    role="tabpanel"
    id="panel-${actionId}-${name}"
    data-tab="${name}"
    hidden
  >
    ${
      src
        ? `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="lazy"${describedById ? ` aria-describedby="${describedById}"` : ''} />`
        : `<p class="screenshot-missing">No ${name} screenshot for this action.</p>`
    }
  </div>`;
}

function toReportRelative(rootDir: string, absolute: string): string {
  return relative(`${rootDir}/report`, absolute);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const seconds = (ms / 1000).toFixed(2);
  return `${seconds} s`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
