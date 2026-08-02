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

const ApiDocs = lazy(() => import('../components/api-docs'));
const Privacy = lazy(() => import('../components/privacy/PrivacyPolicyPage'));
const Terms = lazy(() => import('../components/terms/TermsPage'));

function CommonRoute({ label }: { label: string }) {
  const routeView = () => {
    switch (label) {
      case 'API docs':
        return <ApiDocs />;
      case 'privacy policy':
        // CalOPPA requires privacy-policy access without an account
        return <Privacy />;
      case 'terms and conditions':
        return <Terms />;
    }
  };

  return (
    <Suspense
      fallback={
        <div
          data-theme="branding"
          className="flex items-center justify-center min-h-screen bg-hit-man text-[var(--base-text)] select-none"
        >
          <p role="status" aria-live="polite" className="sr-only">
            Loading {label}…
          </p>
          <i
            className="fa-solid fa-arrows-rotate fa-spin text-4xl opacity-50"
            aria-hidden="true"
          />
        </div>
      }
    >
      {routeView()}
    </Suspense>
  );
}

export function commonRoutes() {
  return [
    <Route
      key="api-docs"
      path="/docs"
      element={<CommonRoute label="API docs" />}
    />,
    <Route
      key="privacy"
      path="/privacy"
      element={<CommonRoute label="privacy policy" />}
    />,
    <Route
      key="terms"
      path="/terms"
      element={<CommonRoute label="terms and conditions" />}
    />,
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
