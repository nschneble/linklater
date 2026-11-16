import { describeMigratedFiles } from './chrome-token-migration.testSetup';

const MIGRATED_FILES = [
  'src/components/auth/AlreadySignedInNotice.tsx',
  'src/components/auth/AuthCard.tsx',
  'src/components/auth/AuthForm.tsx',
  'src/components/auth/ForgotPasswordView.tsx',
  'src/components/auth/LoginRegisterView.tsx',
  'src/components/auth/LogoutPage.tsx',
  'src/components/auth/MfaChallengeSwitch.tsx',
  'src/components/auth/MfaCodeField.tsx',
  'src/components/auth/MfaView.tsx',
  'src/components/auth/ConfirmAccountDeletionPage.tsx',
  'src/components/auth/ExtensionAccountChanged.tsx',
  'src/components/auth/ExtensionAuthorizeCard.tsx',
  'src/components/auth/ExtensionAuthorizePage.tsx',
  'src/components/auth/ExtensionRequestUnreadable.tsx',
  'src/components/auth/MfaStep.tsx',
  'src/components/auth/OAuthCallbackPage.tsx',
  'src/components/auth/ResetPasswordForm.tsx',
  'src/components/auth/ResetPasswordPage.tsx',
  'src/components/auth/VerifyLoginPage.tsx',
] as const;

describeMigratedFiles(MIGRATED_FILES);
