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

    // `/settings` is a single route; sections are reached by scrolling or
    // clicking the in-page sidebar nav, not by URL. `/settings/api` is a
    // separate carve-out (the dedicated API docs view).
    ...['editor', 'read', 'settings', 'settings/api', 'unread'].map((key) => (
      <Route key={key} path={`/${key}`} element={<AppShell />} />
    )),

    <Route key="stumble" path="/stumble" element={<StumblePage />} />,
    <Route key="not-found" path="*" element={<NotFoundView />} />,
  ];
}
