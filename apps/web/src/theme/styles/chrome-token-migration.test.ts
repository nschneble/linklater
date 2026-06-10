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
  'src/components/auth/AuthCard.tsx',
  'src/components/auth/AuthErrorPanel.tsx',
  'src/components/auth/AuthForm.tsx',
  'src/components/auth/ForgotPasswordView.tsx',
  'src/components/auth/LoginRegisterView.tsx',
  'src/components/auth/LogoutPage.tsx',
  'src/components/auth/MfaView.tsx',
  'src/components/common/CopyRevealPanel.tsx',
  'src/components/common/FormInput.tsx',
  'src/components/common/IconButton.tsx',
  'src/components/common/IconListButton.tsx',
  'src/components/common/LinkButton.tsx',
  'src/components/common/SlidingTabBar.tsx',
  'src/components/common/TabButton.tsx',
  'src/components/common/Toast.tsx',
  'src/components/links/LinkCard/index.tsx',
  'src/components/links/LinkCard/LinkCardSkeleton.tsx',
  'src/components/links/LinkCardLayout.tsx',
  'src/components/links/LinkForm.tsx',
  'src/components/links/LinksControls.tsx',
  'src/components/links/LinksList.tsx',
  'src/components/links/LinksMobileControls.tsx',
  'src/components/links/LinksToolbar.tsx',
  'src/components/links/LinksView.tsx',
  'src/components/links/SuggestionCallout.tsx',
  'src/components/stumble/PixelArtGhost.tsx',
  'src/components/stumble/StumbleEmptyView.tsx',
  'src/components/stumble/StumblePage.tsx',
  'src/components/stumble/StumbleSection.tsx',
  'src/components/UserMenu/BottomSheetMainPanel.tsx',
  'src/components/UserMenu/BottomSheetThemeSubmenu.tsx',
  'src/components/UserMenu/InlineThemeList.tsx',
  'src/components/UserMenu/MenuItem.tsx',
  'src/components/UserMenu/MenuSection.tsx',
  'src/components/UserMenu/MobileBottomSheet.tsx',
  'src/components/UserMenu/NavMenuItems.tsx',
  'src/components/UserMenu/ThemeSubmenu.tsx',
  'src/components/UserMenu/index.tsx',
  'src/components/api-docs/ApiDocsView.tsx',
  'src/components/api-docs/TokenInput.tsx',
  // The following auth pages are partially migrated (card, headings, paragraphs,
  // buttons) but their `bg-gradient-to-b from-text-muted via-text-muted to-text`
  // page wrappers are deferred per wave 19 brief Q9. Re-add each once the
  // gradient lands on bundle tokens:
  //   - src/components/auth/ConfirmAccountDeletionPage.tsx (wave 27)
  //   - src/components/auth/ExtensionAuthorizePage.tsx (wave 19)
  //   - src/components/auth/OAuthCallbackPage.tsx (wave 27)
  //   - src/components/auth/ResetPasswordPage.tsx (wave 27)
  //   - src/components/auth/VerifyLoginPage.tsx (wave 27)
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
 *     aliases still used by buttons (ExtensionAuthorizePage). --accent-fg
 *     and --accent-hover stay until --orbit-highlight-fg / -hover land on
 *     default + apollo + school-of-rock (deferred). --accent itself is
 *     the active-state outline anchor (SettingsGroup data-[active=true]:
 *     outline-[var(--accent)]) — outline indicator, not focus ring.
 *   --focus-ring                              — universal slot (wave 21).
 *     Migrated chrome files use it; not a legacy alias.
 */
const LEGACY_TOKENS = [
  'var(--text)',
  'var(--text-muted)',
  'var(--text-subtle)',
  'var(--bg)',
  'var(--bg-surface)',
  'var(--bg-elevated)',
  'var(--bg-input)',
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
