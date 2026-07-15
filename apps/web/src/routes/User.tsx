import AppShell from '../AppShell';
import { Navigate, Route } from 'react-router-dom';
import NotFoundView from '../components/errors/NotFoundView';
import StumblePage from '../components/stumble/StumblePage';

function UnreadRedirect() {
  return <Navigate to="/unread" replace />;
}

export function userRoutes() {
  return [
    // The marketing landing page is logged-out-only; an authenticated visitor
    // hitting `/` is sent to their home feed. Element selection (not a
    // useEffect inside LandingPage) means LandingPage never mounts, so the
    // "Get started" / "Log in" CTAs never flash.
    <Route key="root-redirect" path="/" element={<UnreadRedirect />} />,

    ...['forgot-password', 'login', 'signup'].map((key) => (
      <Route
        key={`${key}-redirect`}
        path={`/${key}`}
        element={<UnreadRedirect />}
      />
    )),

    // `/settings` is a single route; sections are reached by scrolling or
    // clicking the in-page sidebar nav, not by URL.
    ...['editor', 'read', 'settings', 'unread'].map((key) => (
      <Route key={key} path={`/${key}`} element={<AppShell />} />
    )),

    // The API docs live at the PUBLIC `/docs` route (see `Common.tsx`), so a
    // logged-out visitor reaches the same page; nothing API-docs-specific lives
    // in the logged-in route table.
    <Route key="stumble" path="/stumble" element={<StumblePage />} />,
    <Route key="not-found" path="*" element={<NotFoundView />} />,
  ];
}
