import ConfirmAccountDeletionPage from '../components/auth/ConfirmAccountDeletionPage';
import ExtensionAuthorizePage from '../components/auth/ExtensionAuthorizePage';
import FailWhalePage from '../components/FailWhalePage';
import LogoutPage from '../components/auth/LogoutPage';
import OAuthCallbackPage from '../components/auth/OAuthCallbackPage';
import ResetPasswordPage from '../components/auth/ResetPasswordPage';
import VerifyEmailChangePage from '../components/verify/VerifyEmailChangePage';
import VerifyEmailPage from '../components/verify/VerifyEmailPage';
import VerifyLoginPage from '../components/auth/VerifyLoginPage';
import { lazy, Suspense } from 'react';
import { Route } from 'react-router';

const ApiDocsView = lazy(() => import('../components/api-docs'));

const PrivacyPolicyPage = lazy(
  () => import('../components/privacy/PrivacyPolicyPage'),
);

const TermsPage = lazy(() => import('../components/terms/TermsPage'));

function ApiDocsRoute() {
  return (
    <Suspense
      fallback={
        <div
          data-theme="branding"
          className="flex items-center justify-center min-h-screen bg-hit-man text-[var(--base-text)] select-none"
        >
          <p role="status" aria-live="polite" className="sr-only">
            Loading API docs…
          </p>
          <i
            className="fa-solid fa-arrows-rotate fa-spin text-4xl opacity-50"
            aria-hidden="true"
          />
        </div>
      }
    >
      <ApiDocsView />
    </Suspense>
  );
}

// CalOPPA requires privacy-policy access without an account
function PrivacyPolicyRoute() {
  return (
    <Suspense
      fallback={
        <div
          data-theme="branding"
          className="flex items-center justify-center min-h-screen bg-hit-man text-[var(--base-text)] select-none"
        >
          <p role="status" aria-live="polite" className="sr-only">
            Loading privacy policy…
          </p>
          <i
            className="fa-solid fa-arrows-rotate fa-spin text-4xl opacity-50"
            aria-hidden="true"
          />
        </div>
      }
    >
      <PrivacyPolicyPage />
    </Suspense>
  );
}

function TermsRoute() {
  return (
    <Suspense
      fallback={
        <div
          data-theme="branding"
          className="flex items-center justify-center min-h-screen bg-hit-man text-[var(--base-text)] select-none"
        >
          <p role="status" aria-live="polite" className="sr-only">
            Loading terms and conditions…
          </p>
          <i
            className="fa-solid fa-arrows-rotate fa-spin text-4xl opacity-50"
            aria-hidden="true"
          />
        </div>
      }
    >
      <TermsPage />
    </Suspense>
  );
}

export function commonRoutes() {
  return [
    <Route key="api-docs" path="/docs" element={<ApiDocsRoute />} />,
    <Route key="privacy" path="/privacy" element={<PrivacyPolicyRoute />} />,
    <Route key="terms" path="/terms" element={<TermsRoute />} />,
    <Route key="logout" path="/logout" element={<LogoutPage />} />,
    <Route
      key="confirm-account-deletion"
      path="/account/confirm-deletion"
      element={<ConfirmAccountDeletionPage />}
    />,

    <Route
      key="oauth-callback"
      path="/oauth/callback"
      element={<OAuthCallbackPage />}
    />,
    <Route
      key="reset-password"
      path="/reset-password"
      element={<ResetPasswordPage />}
    />,
    <Route
      key="verify-email"
      path="/verify-email"
      element={<VerifyEmailPage />}
    />,
    <Route
      key="verify-email-change"
      path="/verify-email-change"
      element={<VerifyEmailChangePage />}
    />,
    <Route
      key="verify-login"
      path="/verify-login"
      element={<VerifyLoginPage />}
    />,
    <Route
      key="extension-authorize"
      path="/extension/authorize"
      element={<ExtensionAuthorizePage />}
    />,
    <Route key="failwhale" path="/failwhale" element={<FailWhalePage />} />,
  ];
}
