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
import { Route } from 'react-router-dom';

export function commonRoutes() {
  return [
    <Route key="root" path="/" element={<LandingPage />} />,
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
