import AuthForm from '../components/auth/AuthForm';
import { Navigate, Route, useLocation } from 'react-router-dom';

function AuthFormWrapper() {
  return (
    <div className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--page-gradient-from)] via-[var(--page-gradient-via)] to-[var(--page-gradient-to)]">
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
    ...['forgot-password', 'login', 'signup'].map((key) => (
      <Route key={key} path={`/${key}`} element={<AuthFormWrapper />} />
    )),

    <Route key="catch-all" path="*" element={<UnauthenticatedRedirect />} />,
  ];
}
