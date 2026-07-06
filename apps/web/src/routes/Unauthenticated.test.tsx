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

import { unauthenticatedRoutes } from './Unauthenticated';
import { render } from '@testing-library/react';
import { MemoryRouter, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

// Stub AuthForm — this suite only asserts the surface wrapper, not the form.
vi.mock('../components/auth/AuthForm', () => ({
  default: () => <div data-testid="auth-form" />,
}));

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>{unauthenticatedRoutes()}</Routes>
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
