/*
 * Anti-regression tripwire for the chrome bundle migration.
 *
 * Asserts that migrated files contain no references to the legacy
 * pre-bundle CSS custom properties. Started with page-chrome +
 * settings, then extended (common components, UserMenu,
 * auth pages, feature views) as files were migrated.
 *
 * Nine of the legacy tokens (`--bg`, `--bg-surface`,
 * `--text`, `--text-muted`, `--text-subtle`, `--border`, `--accent-fg`,
 * `--accent-hover`, `--accent`) are fully retired from the codebase –
 * not declared anywhere. The tripwire still lists them to prevent
 * re-introduction (sister to the `--bg-input` and `--bg-elevated`
 * retirements).
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
  'src/index.css',
  'src/components/FailWhalePage/index.tsx',
  'src/components/Header.tsx',
  'src/components/LandingPage/index.tsx',
  'src/components/LandingPage/FeaturesSection.tsx',
  'src/components/LandingPage/FooterSection.tsx',
  'src/components/LandingPage/HeroSection.tsx',
  'src/components/auth/AuthCard.tsx',
  'src/components/auth/AuthForm.tsx',
  'src/components/auth/ForgotPasswordView.tsx',
  'src/components/auth/LoginRegisterView.tsx',
  'src/components/auth/LogoutPage.tsx',
  'src/components/auth/MfaView.tsx',
  'src/components/common/CopyButton.tsx',
  'src/components/common/CopyRevealPanel.tsx',
  'src/components/common/FormInput.tsx',
  'src/components/common/IconButton.tsx',
  'src/components/common/IconListButton.tsx',
  'src/components/common/LinkButton.tsx',
  'src/components/common/Modal.tsx',
  'src/components/common/SlidingTabBar.tsx',
  'src/components/common/TabButton.tsx',
  'src/components/common/Toast.tsx',
  'src/components/errors/ErrorBoundary.tsx',
  'src/components/errors/NotFoundView.tsx',
  'src/components/links/KeyboardShortcutsModal.tsx',
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
  'src/components/api-docs/ApiReference.tsx',
  'src/components/api-docs/EndpointDetail.tsx',
  'src/components/api-docs/EndpointNav.tsx',
  'src/components/api-docs/EndpointNavCompact.tsx',
  'src/components/api-docs/MethodBadge.tsx',
  'src/components/api-docs/ParameterTable.tsx',
  'src/components/api-docs/RequestBodyEditor.tsx',
  'src/components/api-docs/RequestField.tsx',
  'src/components/api-docs/RequestForm.tsx',
  'src/components/api-docs/ResponsePanel.tsx',
  'src/components/api-docs/ResponseTabs.tsx',
  'src/components/api-docs/SchemaTable.tsx',
  'src/components/api-docs/WelcomePanel.tsx',
  'src/components/auth/ConfirmAccountDeletionPage.tsx',
  'src/components/auth/ExtensionAuthorizePage.tsx',
  'src/components/auth/OAuthCallbackPage.tsx',
  'src/components/auth/ResetPasswordPage.tsx',
  'src/components/auth/VerifyLoginPage.tsx',
  'src/components/verify/TokenVerificationPage.tsx',
  'src/routes/Unauthenticated.tsx',
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
  'src/components/settings/ThemeEditor/CopyFromTheme.tsx',
  'src/components/settings/ThemeEditor/ShowcaseSection.tsx',
  'src/components/settings/ThemeEditor/ThemeSaveBar.tsx',
  'src/components/settings/ThemeEditor/index.tsx',
  'src/components/settings/TotpSetupView.tsx',
  'src/components/welcome/WelcomeModal.tsx',
] as const;

/*
 * Legacy tokens that should NOT appear in any migrated chrome file.
 *
 * Not included:
 *   --focus-ring      – universal slot. Migrated chrome files
 *                       use it; not a legacy alias.
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
  'var(--accent)',
  'var(--accent-fg)',
  'var(--accent-hover)',
] as const;

const FILE_CASES = MIGRATED_FILES.map((relativePath) => ({
  relativePath,
  source: readFileSync(resolve(ROOT, relativePath), 'utf8'),
}));

describe('chrome bundle migration: migrated files contain no pre-bundle CSS variables', () => {
  describe.each(FILE_CASES)('$relativePath', ({ source }) => {
    it.each(LEGACY_TOKENS)('does not reference %s', (token) => {
      expect(source).not.toContain(token);
    });
  });
});
