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

    ...['editor', 'read', 'settings', 'unread'].map((key) => (
      <Route key={key} path={`/${key}`} element={<AppShell />} />
    )),

    <Route key="stumble" path="/stumble" element={<StumblePage />} />,
    <Route key="not-found" path="*" element={<NotFoundView />} />,
  ];
}
