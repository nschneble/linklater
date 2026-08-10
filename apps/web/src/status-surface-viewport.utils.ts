/**
 * The floor tables behind `status-surface-viewport.test.ts` and the tree
 * scans that hold them closed, kept beside the suite so that file stays
 * assertions. Why these units, and why four wrappers across two files are
 * still untreated, is written down there.
 *
 * The tables list occurrences rather than files, because the thing being
 * held is a pairing and not a count: a box that vertically centres its
 * content against a viewport floor is the only place the unit is
 * observable at all. A file carrying two such boxes appears twice, and
 * moving a floor between two boxes in one file changes which table it
 * belongs to. Between them the three cover every viewport floor in the
 * tree, which is why the fourth combination is asserted empty rather
 * than written down.
 */

import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const THIS_MODULE = 'src/status-surface-viewport.utils.ts';

/** Centring boxes floored on the stable small viewport. */
export const CENTRED_SMALL_VIEWPORT_FLOORS = [
  'src/App.tsx',
  'src/components/FailWhalePage/index.tsx',
  'src/components/auth/ConfirmAccountDeletionPage.tsx',
  'src/components/auth/OAuthCallbackPage.tsx',
  'src/components/auth/ResetPasswordPage.tsx',
  'src/components/auth/VerifyLoginPage.tsx',
  'src/components/errors/ErrorBoundary.tsx',
  'src/components/errors/NotFoundView.tsx',
  'src/components/stumble/StumbleEmptyView.tsx',
  'src/components/stumble/StumblePage.tsx',
  'src/components/stumble/StumblePage.tsx',
  'src/components/verify/TokenVerificationPage.tsx',
  'src/routes/Common.tsx',
];

/** The gradient auth-card wrappers, still centring on the large viewport. */
export const CENTRED_LARGE_VIEWPORT_FLOORS = [
  'src/components/auth/ExtensionAuthorizePage.tsx',
  'src/components/auth/ExtensionAuthorizePage.tsx',
  'src/components/auth/ResetPasswordPage.tsx',
  'src/components/auth/ResetPasswordPage.tsx',
  'src/routes/Unauthenticated.tsx',
];

/** Large-viewport floors under boxes that centre nothing. */
export const UNCENTRED_LARGE_VIEWPORT_FLOORS = [
  'src/AppShell.tsx',
  'src/components/FailWhalePage/index.tsx',
  'src/components/LandingPage/index.tsx',
  'src/components/api-docs/ApiDocsView.tsx',
  'src/components/legal/PolicyDocumentPage.tsx',
];

/** The two floors the tables above hold, and the only ones allowed. */
export const PINNED_SMALL_FLOOR = 'min-h-svh';
export const PINNED_LARGE_FLOOR = 'min-h-screen';

const FLOOR_PREFIXES = ['min-h', 'h'];

const LARGER_VIEWPORT_UNITS = ['screen', 'lvh', 'dvh', '[100vh]', '[100dvh]'];

/**
 * Every way of asking for a full-height box other than the two the tables
 * above hold, banned so a new surface cannot sidestep them by spelling the
 * same height differently. Composed rather than written out, because a
 * literal here would be a class the bundler compiles into the shipped
 * sheet for nobody. The ban reaches floors only: a scrolling box may cap
 * itself against the dynamic viewport, and the links dropdown does.
 */
export const SIBLING_FLOOR_UTILITIES = FLOOR_PREFIXES.flatMap((prefix) =>
  LARGER_VIEWPORT_UNITS.map((unit) => `${prefix}-${unit}`),
).filter((utility) => utility !== PINNED_LARGE_FLOOR);

/**
 * Wraps a pattern so it can only match a whole utility class. Each exact
 * height names a suffix of its own floor, so an unanchored search for a
 * banned one reports every legal floor that ends the same way.
 */
function whole(body: string): RegExp {
  return new RegExp(`(?<![\\w-])(?:${body})(?![\\w-])`);
}

/** Escapes an arbitrary-value utility's brackets for use in a pattern. */
function escaped(utility: string): string {
  return utility.replace(/[[\]]/g, String.raw`\$&`);
}

const CENTRING = whole('(?:items|justify)-center');

const SMALL_FLOOR = whole(PINNED_SMALL_FLOOR);

const OTHER_FLOOR = whole(
  [PINNED_LARGE_FLOOR, ...SIBLING_FLOOR_UTILITIES].map(escaped).join('|'),
);

const CLASS_NAME = /className=(?:"([^"]*)"|\{`([^`]*)`\})/g;

function occurrencesOf(pattern: RegExp, text: string): number {
  return text.split(pattern).length - 1;
}

/** Reads any file under `src` by its repo-relative path. */
function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

/**
 * Every file under `src` except this module and every test file. Tests
 * carry these utilities as assertion literals rather than to lay anything
 * out, and none of them ships.
 */
function sourceFiles(): string[] {
  return readdirSync(resolve(ROOT, 'src'), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(ROOT, resolve(entry.parentPath, entry.name)))
    .filter((path) => !/\.test\.tsx?$/.test(path) && path !== THIS_MODULE);
}

/**
 * Every place the tree spells the given floor as a whole class of its
 * own, one entry per occurrence. Searches the raw file rather than its
 * parsed class attributes, so it still counts a floor hoisted into a
 * constant or assembled in a template literal.
 */
export function floorOccurrences(utility: string): string[] {
  const pattern = whole(escaped(utility));
  return sourceFiles()
    .flatMap((path) =>
      Array<string>(occurrencesOf(pattern, readSource(path))).fill(path),
    )
    .sort();
}

export type FloorGroup =
  'centred-small' | 'centred-large' | 'uncentred-small' | 'uncentred-large';

/**
 * Every floored box in the tree belonging to the given group, one entry
 * per occurrence. The four groups partition every viewport floor there
 * is, so a box that drifts between them lands in a list that does not
 * expect it. Reads parsed `className` literals, which leaves a floor
 * assembled at runtime to the whole-file scans.
 */
export function flooredBoxes(group: FloorGroup): string[] {
  const centred = group.startsWith('centred');
  const floor = group.endsWith('small') ? SMALL_FLOOR : OTHER_FLOOR;
  return sourceFiles()
    .flatMap((path) =>
      [...readSource(path).matchAll(CLASS_NAME)]
        .map((match) => match[1] ?? match[2])
        .filter((classes) => occurrencesOf(CENTRING, classes) > 0 === centred)
        .flatMap((classes) =>
          Array<string>(occurrencesOf(floor, classes)).fill(path),
        ),
    )
    .sort();
}
