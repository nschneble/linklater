/**
 * Tests for the unauthenticated route table.
 *
 * The login / signup / forgot-password surfaces must always render in the
 * off-book `branding` chrome, never a stale film/custom palette from a
 * lingering session. `AuthFormWrapper` carries `data-theme="branding"` on its
 * full-viewport wrapper so the paint can't inherit the document theme. These
 * routes always redirect an authenticated visitor away (routes/User.tsx), so
 * pinning branding here is unconditional and safe. See branding.css.
 */

import { commonRoutes } from './Common';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, useLocation } from 'react-router-dom';
import { unauthenticatedRoutes } from './Unauthenticated';
import { userRoutes } from './User';
import { describe, expect, it, vi } from 'vitest';

// Stub AuthForm — this suite only asserts the surface wrapper, not the form.
vi.mock('../components/auth/AuthForm', () => ({
  default: () => <div data-testid="auth-form" />,
}));

// Stub AppShell. The authenticated `/` → `/unread` redirect target pulls in
// the full data/theme/auth stack; this suite only asserts the redirect landed.
vi.mock('../AppShell', () => ({
  default: () => <div data-testid="app-shell" />,
}));

// Surfaces the current pathname so redirect assertions can read where the
// route table settled.
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{unauthenticatedRoutes()}</Routes>
    </MemoryRouter>,
  );
}

// Mirrors App.tsx's composition for a logged-out visitor.
function renderLoggedOutAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        {commonRoutes()}
        {unauthenticatedRoutes()}
      </Routes>
    </MemoryRouter>,
  );
}

// Mirrors App.tsx's composition for an authenticated visitor.
function renderAuthenticatedAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LocationProbe />
      <Routes>
        {commonRoutes()}
        {userRoutes()}
      </Routes>
    </MemoryRouter>,
  );
}

describe('unauthenticated auth surfaces are branding-pinned', () => {
  for (const path of ['/login', '/signup', '/forgot-password']) {
    it(`pins branding on ${path}`, () => {
      const { container } = renderAt(path);
      const branded = container.querySelector('[data-theme="branding"]');
      expect(branded).not.toBeNull();
      expect(branded?.className).toMatch(/min-h-screen/);
    });
  }
});

describe('auth surface top-aligns the card on mobile', () => {
  // Centering a short card in `min-h-screen` leaves an oversized top gap on
  // tall phones, and on a short viewport (soft keyboard open / 200% zoom) it
  // pushes the card's top off-screen. The wrapper top-aligns with padding on
  // mobile (`items-start` + `pt-16`) and only restores vertical centering at
  // `sm`, while keeping `min-h-screen` so the full-height gradient is intact.
  for (const path of ['/login', '/signup', '/forgot-password']) {
    it(`top-aligns the card with padding on ${path}, centering only at sm`, () => {
      const { container } = renderAt(path);
      const branded = container.querySelector('[data-theme="branding"]');

      expect(branded?.className).toMatch(/items-start/);
      expect(branded?.className).toMatch(/sm:items-center/);
      expect(branded?.className).toMatch(/pt-16/);
      // The full-height gradient must not be shrunk (padding, never a smaller
      // wrapper or a negative margin).
      expect(branded?.className).toMatch(/min-h-screen/);
    });
  }
});

describe('root `/` route selects the visitor-appropriate element', () => {
  it('redirects an authenticated visitor to /unread with no landing CTAs', () => {
    renderAuthenticatedAt('/');

    // Element selection swaps in <Navigate> before LandingPage ever mounts,
    // so the "Get started" / "Log in" CTAs never render (zero flash).
    expect(screen.getByTestId('location')).toHaveTextContent('/unread');
    expect(screen.queryByText('Get started')).toBeNull();
    expect(screen.queryByText('Log in')).toBeNull();
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
  });

  it('renders the landing page for a logged-out visitor (no /login bounce)', () => {
    renderLoggedOutAt('/');

    // C3: the explicit `/` route must win over the catch-all `*` → /login so
    // the marketing page survives instead of bouncing to the auth surface.
    expect(screen.getByTestId('location')).toHaveTextContent('/');
    expect(screen.getByText('Get started')).toBeInTheDocument();
    expect(screen.getByText('Log in')).toBeInTheDocument();
  });
});
