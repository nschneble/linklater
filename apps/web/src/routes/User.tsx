import AppShell from '../AppShell';
import { lazy, Suspense } from 'react';
import { Navigate, Route } from 'react-router-dom';
import NotFoundView from '../components/errors/NotFoundView';
import StumblePage from '../components/stumble/StumblePage';

// ApiDocsView is lazy-loaded because the custom docs UI plus the OpenAPI
// parse layer form a self-contained chunk only /settings/api visitors need;
// keeping it out of the main bundle (which no longer carries the retired
// ~300KB Scalar embed) means everyone else never downloads it.
const ApiDocsView = lazy(() => import('../components/api-docs'));

function UnreadRedirect() {
  return <Navigate to="/unread" replace />;
}

function ApiDocsRoute() {
  return (
    <Suspense
      fallback={
        <div
          aria-live="polite"
          className="flex items-center justify-center min-h-screen bg-hit-man text-dazed text-sm select-none"
        >
          Loading API docs…
        </div>
      }
    >
      <ApiDocsView />
    </Suspense>
  );
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
    // clicking the in-page sidebar nav, not by URL.
    ...['editor', 'read', 'settings', 'unread'].map((key) => (
      <Route key={key} path={`/${key}`} element={<AppShell />} />
    )),

    // `/settings/api` is a brand-chrome page (not the user-theme app
    // shell), so it's a standalone route alongside `/stumble`.
    <Route
      key="settings-api"
      path="/settings/api"
      element={<ApiDocsRoute />}
    />,
    <Route key="stumble" path="/stumble" element={<StumblePage />} />,
    <Route key="not-found" path="*" element={<NotFoundView />} />,
  ];
}
