/**
 * The surface table behind `status-surface-viewport.test.ts` and the tree
 * scans that hold it closed, kept beside the suite so that file stays
 * assertions. Why these units, and why four files are still untreated,
 * is written down there.
 *
 * `svh` and `screen` are the Tailwind suffixes: how many times the file
 * holds `min-h-svh` and how many times it holds `min-h-screen`. A file
 * may legitimately carry both, and two of them do.
 */

import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const THIS_MODULE = 'src/status-surface-viewport.pins.ts';

interface SurfaceFloorCounts {
  svh: number;
  screen: number;
}

export const SURFACES: Record<string, SurfaceFloorCounts> = {
  'src/App.tsx': { svh: 1, screen: 0 },
  'src/AppShell.tsx': { svh: 0, screen: 1 },
  'src/components/FailWhalePage/index.tsx': { svh: 1, screen: 1 },
  'src/components/LandingPage/index.tsx': { svh: 0, screen: 1 },
  'src/components/api-docs/ApiDocsView.tsx': { svh: 0, screen: 1 },
  'src/components/auth/ConfirmAccountDeletionPage.tsx': { svh: 1, screen: 0 },
  'src/components/auth/ExtensionAuthorizePage.tsx': { svh: 0, screen: 2 },
  'src/components/auth/OAuthCallbackPage.tsx': { svh: 1, screen: 0 },
  'src/components/auth/ResetPasswordPage.tsx': { svh: 1, screen: 2 },
  'src/components/auth/VerifyLoginPage.tsx': { svh: 1, screen: 0 },
  'src/components/errors/ErrorBoundary.tsx': { svh: 1, screen: 0 },
  'src/components/errors/NotFoundView.tsx': { svh: 1, screen: 0 },
  'src/components/legal/PolicyDocumentPage.tsx': { svh: 0, screen: 1 },
  'src/components/stumble/StumbleEmptyView.tsx': { svh: 1, screen: 0 },
  'src/components/stumble/StumblePage.tsx': { svh: 2, screen: 0 },
  'src/components/verify/TokenVerificationPage.tsx': { svh: 1, screen: 0 },
  'src/routes/Common.tsx': { svh: 1, screen: 0 },
  'src/routes/Unauthenticated.tsx': { svh: 0, screen: 1 },
};

/** Reads any file under `src` by its repo-relative path. */
export function readSource(relativePath: string): string {
  return readFileSync(resolve(ROOT, relativePath), 'utf8');
}

/**
 * Every file under `src` holding the utility, the suite's own files
 * aside: those carry it as an assertion literal rather than to lay
 * anything out, and neither one ships.
 */
export function filesUsing(utility: string): string[] {
  return readdirSync(resolve(ROOT, 'src'), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(ROOT, resolve(entry.parentPath, entry.name)))
    .filter((path) => !/\.test\.tsx?$/.test(path) && path !== THIS_MODULE)
    .filter((path) => readSource(path).includes(utility))
    .sort();
}

/** The listed files carrying at least one floor in the given unit. */
export function surfacesUsing(unit: keyof SurfaceFloorCounts): string[] {
  return Object.entries(SURFACES)
    .filter(([, counts]) => counts[unit] > 0)
    .map(([relativePath]) => relativePath)
    .sort();
}
