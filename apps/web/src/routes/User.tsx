import AppShell from '../AppShell';
import { Navigate, Route } from 'react-router';
import NotFoundView from '../components/errors/NotFoundView';
import StumblePage from '../components/stumble/StumblePage';

function UnreadRedirect() {
  return <Navigate to="/unread" replace />;
}

export function userRoutes() {
  return [
    // element redirect (not useEffect) so LandingPage never mounts/flashes
    <Route key="root-redirect" path="/" element={<UnreadRedirect />} />,

    ...['forgot-password', 'login', 'signup'].map((key) => (
      <Route
        key={`${key}-redirect`}
        path={`/${key}`}
        element={<UnreadRedirect />}
      />
    )),

    // /settings is one route; sections via scroll/sidebar nav, not URL
    ...['editor', 'read', 'settings', 'unread'].map((key) => (
      <Route key={key} path={`/${key}`} element={<AppShell />} />
    )),

    // API docs are public at /docs (see Common.tsx); nothing lives here
    <Route key="stumble" path="/stumble" element={<StumblePage />} />,
    <Route key="not-found" path="*" element={<NotFoundView />} />,
  ];
}
