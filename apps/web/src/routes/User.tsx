import AppShell from '../AppShell';
import { Navigate, Route } from 'react-router-dom';
import NotFoundView from '../components/errors/NotFoundView';
import StumblePage from '../components/stumble/StumblePage';

function UnreadRedirect() {
  return <Navigate to="/unread" replace />;
}

export function userRoutes() {
  return [
    ...['forgot-password', 'login', 'signup'].map((key) => (
      <Route
        key={`${key}-redirect`}
        path={`/${key}`}
        element={<UnreadRedirect />}
      />
    )),

    ...['editor', 'read', 'settings/api', 'unread'].map((key) => (
      <Route key={key} path={`/${key}`} element={<AppShell />} />
    )),

    // `/settings/:section?` is one route — `AppShell` resolves the optional
    // `section` param against the known section list. Deep links like
    // `/settings/bookmarks` and `/settings/integrations` all hit this route.
    // `/settings/api` lives above as a separate carve-out (a different view).
    <Route key="settings" path="/settings/:section?" element={<AppShell />} />,

    <Route key="stumble" path="/stumble" element={<StumblePage />} />,
    <Route key="not-found" path="*" element={<NotFoundView />} />,
  ];
}
