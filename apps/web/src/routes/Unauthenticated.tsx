import AuthForm from '../components/auth/AuthForm';
import LandingPage from '../components/LandingPage';
import { Navigate, Route, useLocation } from 'react-router';

// pin branding at the surface so it survives auth-gate/hydration edges
function AuthFormWrapper() {
  return (
    <div
      data-theme="branding"
      className="flex items-start sm:items-center justify-center min-h-screen px-4 pt-16 sm:pt-0 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]"
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
    // React Router ranks by specificity, so "/" must exist or root hits *
    <Route key="root" path="/" element={<LandingPage />} />,

    ...['forgot-password', 'login', 'signup'].map((key) => (
      <Route key={key} path={`/${key}`} element={<AuthFormWrapper />} />
    )),

    <Route key="catch-all" path="*" element={<UnauthenticatedRedirect />} />,
  ];
}
