/*
 * Anti-regression tripwire for the Wave 19 chrome bundle migration.
 *
 * Asserts that the page-chrome + settings files migrated in Wave 19 contain
 * no references to the legacy pre-bundle CSS custom properties. Legacy
 * tokens still appear in auth pages, common components, feature views, and
 * UserMenu chrome (deferred to wave 20+) — this guard is scoped only to
 * files Wave 19 owned.
 *
 * Fires before the WCAG contrast suite runs, so a regression here is
 * caught as a flat string mismatch rather than a downstream contract
 * failure.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const MIGRATED_FILES = [
  'src/App.tsx',
  'src/AppShell.tsx',
  'src/components/Header.tsx',
  'src/components/api-docs/ApiDocsView.tsx',
  'src/components/api-docs/TokenInput.tsx',
  // ExtensionAuthorizePage.tsx is partially migrated (card, headings, buttons)
  // but its `bg-gradient-to-b from-text-muted via-text-muted to-text` page
  // wrapper is deferred to wave 20 alongside the login bg gradient — see
  // wave 19 brief Q9. Re-add once the gradient lands on bundle tokens.
  'src/components/settings/ApiTokensList/ApiTokenRow.tsx',
  'src/components/settings/ApiTokensList/index.tsx',
  'src/components/settings/ApiTokensSection/index.tsx',
  'src/components/settings/BookmarkletSection.tsx',
  'src/components/settings/CvdModeToggle.tsx',
  'src/components/settings/EmailSettingsForm.tsx',
  'src/components/settings/IdPsSection/ProviderRow.tsx',
  'src/components/settings/IdPsSection/index.tsx',
  'src/components/settings/MultiFactorSection/index.tsx',
  'src/components/settings/PasswordSettingsForm/AddPasswordForm.tsx',
  'src/components/settings/PasswordSettingsForm/ChangePasswordForm.tsx',
  'src/components/settings/ReauthForm.tsx',
  'src/components/settings/SettingsGroup.tsx',
  'src/components/settings/SettingsLayout.tsx',
  'src/components/settings/SettingsSectionNav.tsx',
  'src/components/settings/SettingsView.tsx',
  'src/components/settings/ThemeEditor/ColorEditor.tsx',
  'src/components/settings/ThemeEditor/ComponentShowcase.tsx',
  'src/components/settings/ThemeEditor/ContrastChecker.tsx',
  'src/components/settings/ThemeEditor/ShowcaseSection.tsx',
  'src/components/settings/ThemeEditor/index.tsx',
  'src/components/settings/TotpSetupView.tsx',
] as const;

/*
 * Legacy tokens that should NOT appear in any wave-19 migrated chrome file.
 *
 * Not included:
 *   --accent / --accent-fg / --accent-hover  — universally-defined legacy
 *     aliases still used by buttons (ExtensionAuthorizePage) and focus
 *     rings (universal). Defer to wave 20 when --orbit-highlight-fg lands
 *     on every theme.
 *   --bg-input                                — input-bg slot deferred to
 *     wave 20; only ColorEditor still references it and that is intentional.
 */
const LEGACY_TOKENS = [
  'var(--text)',
  'var(--text-muted)',
  'var(--text-subtle)',
  'var(--bg)',
  'var(--bg-surface)',
  'var(--bg-elevated)',
  'var(--border)',
] as const;

const FILE_CASES = MIGRATED_FILES.map((relativePath) => ({
  relativePath,
  source: readFileSync(resolve(ROOT, relativePath), 'utf8'),
}));

describe('Wave 19: chrome files contain no pre-bundle CSS variables', () => {
  describe.each(FILE_CASES)('$relativePath', ({ source }) => {
    it.each(LEGACY_TOKENS)('does not reference %s', (token) => {
      expect(source).not.toContain(token);
    });
  });
});
