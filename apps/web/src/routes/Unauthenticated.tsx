import AlreadySignedInNotice from '../components/auth/AlreadySignedInNotice';
import { announceOfferBounce } from '../components/auth/offerBounce';
import AuthForm from '../components/auth/AuthForm';
import LandingPage from '../components/LandingPage';
import { Navigate, Route, useLocation } from 'react-router';
import { useEffect } from 'react';

/**
 * Pins branding at the surface so it survives auth-gate/hydration edges.
 *
 * The sibling-signed-in notice mounts here rather than inside `AuthForm`
 * so one always-mounted live region covers login, signup and
 * forgot-password alike, and so the visible notice sits above the form
 * instead of inside its card. Exported for tests, which need to reach it
 * without standing up the router.
 */
export function AuthFormWrapper() {
  return (
    <div
      data-theme="branding"
      className="flex items-start sm:items-center justify-center min-h-screen px-4 pt-16 sm:pt-0 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]"
    >
      <div className="w-full max-w-md">
        <AlreadySignedInNotice />
        <AuthForm />
      </div>
    </div>
  );
}

/**
 * The auth gate: reached only once a load has come back with no user, on
 * a path that needs one. That makes it the only place that can tell a
 * followed offer from a landed one, which is why it and not the notice
 * arms the arrival's explanation (`offerBounce.ts`).
 *
 * The queue lands a whole commit before the login form mounts: React
 * flushes a commit's passive effects as a unit, so this one runs after
 * `Navigate` asks for the move and before the render it schedules.
 */
function UnauthenticatedRedirect() {
  const location = useLocation();
  useEffect(announceOfferBounce, []);
  return <Navigate to="/login" state={{ from: location.pathname }} replace />;
}

export function unauthenticatedRoutes() {
  return [
    // React Router ranks by specificity, so "/" must exist or root hits *
    <Route key="root" path="/" element={<LandingPage />} />,

    ...['forgot-password', 'login', 'signup'].map((key) => (
      <Route key={key} path={`/${key}`} element={<AuthFormWrapper />} />
    )),

    <Route key="catch-all" path="*" element={<UnauthenticatedRedirect />} />,
  ];
}
