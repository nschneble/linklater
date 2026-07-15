import AuthForm from '../components/auth/AuthForm';
import LandingPage from '../components/LandingPage';
import { Navigate, Route, useLocation } from 'react-router-dom';

// `data-theme="branding"` pins the login / signup / forgot-password surface
// (and the MFA sub-view AuthForm renders inside it) to the off-book branding
// chrome unconditionally. These routes always redirect an authenticated visitor
// away (routes/User.tsx), so they are only ever seen logged out — painting
// branding here at the surface makes it immune to any auth-gate, custom-theme,
// or hydration-timing edge case instead of depending on the document-level
// gate. Branding defines --page-gradient-from/to in-block (branding.css), so the
// wrapper gradient composites brand navy, not the :root fallback.
function AuthFormWrapper() {
  return (
    <div
      data-theme="branding"
      className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]"
    >
      <AuthForm />
    </div>
  );
}

function UnauthenticatedRedirect() {
  const location = useLocation();
  return <Navigate to="/login" state={{ from: location.pathname }} replace />;
}

export function unauthenticatedRoutes() {
  return [
    // The public marketing landing page. This explicit `/` route must be
    // registered so it outranks the catch-all `*` → /login below; without it a
    // logged-out visitor to the root would be swallowed by the catch-all and
    // bounced to the auth surface.
    <Route key="root" path="/" element={<LandingPage />} />,

    ...['forgot-password', 'login', 'signup'].map((key) => (
      <Route key={key} path={`/${key}`} element={<AuthFormWrapper />} />
    )),

    <Route key="catch-all" path="*" element={<UnauthenticatedRedirect />} />,
  ];
}
