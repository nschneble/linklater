import ConfirmAccountDeletionPage from '../components/auth/ConfirmAccountDeletionPage';
import ExtensionAuthorizePage from '../components/auth/ExtensionAuthorizePage';
import FailWhalePage from '../components/FailWhalePage';
import LandingPage from '../components/LandingPage';
import LogoutPage from '../components/auth/LogoutPage';
import OAuthCallbackPage from '../components/auth/OAuthCallbackPage';
import ResetPasswordPage from '../components/auth/ResetPasswordPage';
import VerifyEmailChangePage from '../components/verify/VerifyEmailChangePage';
import VerifyEmailPage from '../components/verify/VerifyEmailPage';
import VerifyLoginPage from '../components/auth/VerifyLoginPage';
import { lazy, Suspense } from 'react';
import { Route } from 'react-router-dom';

// ApiDocsView is lazy-loaded because the custom docs UI plus the OpenAPI
// parse layer form a self-contained chunk only /docs visitors need; keeping
// it out of the main bundle (which no longer carries the retired ~300KB
// Scalar embed) means everyone else never downloads it.
const ApiDocsView = lazy(() => import('../components/api-docs'));

// The API docs are PUBLIC (logged-out renders the marketing brand chrome;
// logged-in renders the user's active theme), so the route lives here in the
// common table rather than the logged-in-only one.
function ApiDocsRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-hit-man text-dazed text-sm select-none">
          Loading API docs…
        </div>
      }
    >
      <ApiDocsView />
    </Suspense>
  );
}

export function commonRoutes() {
  return [
    <Route key="root" path="/" element={<LandingPage />} />,
    <Route key="api-docs" path="/docs" element={<ApiDocsRoute />} />,
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
