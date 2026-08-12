/**
 * Tests for the unauthenticated shell around the login form.
 *
 * The real `AuthForm` and the real `useAuthForm` render here on purpose.
 * The claim under test is that a sibling tab signing in leaves this tab's
 * half-filled form alone, and only a form whose state is genuinely
 * component-local can prove that; a mocked hook would hold the email in
 * the test instead of in the component that is supposed to lose it.
 *
 * `window.location.assign` is spied in `beforeEach` rather than inside the
 * one test that reads it. Installed per-test it proves nothing about the
 * rest: a notice that took the move automatically would leave every
 * preservation test below green, because a jsdom navigation changes no
 * DOM. Those tests also confirm the notice appeared before asserting what
 * survived, so a handler that threw on entry cannot pass them by doing
 * nothing at all.
 *
 * The route table is pinned separately in
 * `Unauthenticated.routes.test.tsx`, which needs `AuthForm` stubbed and so
 * cannot share a module-scoped mock with this file.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthFormWrapper } from './Unauthenticated';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// the real key filter, so the ignored-key cases exercise what ships
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  forgotPassword: vi.fn(),
  getStoredToken: vi.fn(),
  readTokenClaims: vi.fn(),
  registerMagicLink: vi.fn(),
  requestMagicLink: vi.fn(),
  verifyOtp: vi.fn(),
}));

import * as apiModule from '../lib/api';
import { useAuth } from '../auth/AuthContext';

const ACTION = 'Go to your links';
const ANNOUNCEMENT = 'already-signed-in-announcement';
const MESSAGE = "You're already signed in.";
const RENDERED_IDENTITY_KEY = 'linklater_rendered_identity';

const realLocation = window.location;
let assignMock: ReturnType<typeof vi.fn>;

function siblingSignedInAs(subject: string | null) {
  vi.mocked(apiModule.getStoredToken).mockReturnValue('sibling-jwt');
  vi.mocked(apiModule.readTokenClaims).mockReturnValue(
    subject === null ? null : { exp: null, subject },
  );
}

function siblingSignedOut() {
  vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
  vi.mocked(apiModule.readTokenClaims).mockReturnValue(null);
}

function fireStorageEvent(key: string | null = 'linklater_token') {
  fireEvent(window, new StorageEvent('storage', { key }));
}

/** The painted copy of the message, as opposed to the sr-only mirror. */
function visibleNotice(): HTMLElement {
  const painted = screen
    .getAllByText(MESSAGE)
    .find((element) => element.closest('.sr-only') === null);
  if (!painted) throw new Error('no visible notice rendered');
  return painted;
}

function noticeIsShowing(): boolean {
  return screen.queryByRole('link', { name: ACTION }) !== null;
}

function renderLoginScreen() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthFormWrapper />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  assignMock = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...realLocation, assign: assignMock },
    writable: true,
  });
  vi.mocked(useAuth).mockReturnValue({
    login: vi.fn(),
    refreshUser: vi.fn(),
    register: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
  vi.mocked(apiModule.readTokenClaims).mockReturnValue(null);
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: realLocation,
    writable: true,
  });
});

describe('the live region before anything happens', () => {
  it('is mounted so a screen reader has a region to report a change in', () => {
    renderLoginScreen();
    expect(screen.getByTestId(ANNOUNCEMENT)).toBeInTheDocument();
  });

  it('is empty, so its text is not read as part of the page load', () => {
    renderLoginScreen();
    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe('');
  });

  it('is polite and atomic, not an assertive interrupt', () => {
    renderLoginScreen();
    const region = screen.getByTestId(ANNOUNCEMENT);
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
  });

  it('shows no notice while nobody is signed in anywhere', () => {
    renderLoginScreen();
    expect(noticeIsShowing()).toBe(false);
  });
});

describe('a sibling tab signs in', () => {
  it('populates the live region, which is the transition SRs announce', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();

    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe(MESSAGE);
  });

  it('surfaces a visible notice carrying the same words as the region', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();

    // both channels, one string: they cannot drift apart
    expect(screen.getAllByText(MESSAGE)).toHaveLength(2);
    expect(visibleNotice()).toBeInTheDocument();
  });

  it('offers an action rather than taking it', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();

    expect(screen.getByRole('link', { name: ACTION })).toBeInTheDocument();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it('leaves the typed email in place (WCAG 3.3.7 Redundant Entry)', () => {
    renderLoginScreen();
    const email = screen.getByLabelText(/email/i);
    fireEvent.change(email, { target: { value: 'half-typed@example.com' } });

    siblingSignedInAs('user-2');
    fireStorageEvent();

    expect(noticeIsShowing()).toBe(true);
    expect(assignMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/email/i)).toHaveValue(
      'half-typed@example.com',
    );
  });

  it('leaves the typed password in place, which no manager holds a copy of', () => {
    renderLoginScreen();
    const password = screen.getByLabelText(/password/i);
    fireEvent.change(password, { target: { value: 'still-typing' } });

    siblingSignedInAs('user-2');
    fireStorageEvent();

    expect(noticeIsShowing()).toBe(true);
    expect(assignMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/password/i)).toHaveValue('still-typing');
  });

  it('leaves the login form standing rather than replacing it', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();

    expect(noticeIsShowing()).toBe(true);
    expect(assignMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('never moves focus off the field the caret was in', () => {
    renderLoginScreen();
    const password = screen.getByLabelText(/password/i);
    password.focus();

    siblingSignedInAs('user-2');
    fireStorageEvent();

    expect(noticeIsShowing()).toBe(true);
    expect(document.activeElement).toBe(password);
  });

  it('is not a toast: it stays put in the flow, not fixed to the viewport', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();

    const notice = visibleNotice().closest('div');
    expect(notice?.className).not.toContain('fixed');
    expect(notice?.className).not.toContain('z-50');
  });

  it('is not a toast: nothing times it out', () => {
    vi.useFakeTimers();
    try {
      renderLoginScreen();
      siblingSignedInAs('user-2');
      fireStorageEvent();

      vi.advanceTimersByTime(60_000);

      expect(noticeIsShowing()).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('storage changes that are not a sibling signing in', () => {
  // each proves the listener still live: a throwing handler cannot pass
  it('ignores a storage event that leaves no token behind', () => {
    renderLoginScreen();
    siblingSignedOut();
    fireStorageEvent();
    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe('');

    siblingSignedInAs('user-2');
    fireStorageEvent();
    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe(MESSAGE);
  });

  it('ignores a token whose owner cannot be read', () => {
    renderLoginScreen();
    siblingSignedInAs(null);
    fireStorageEvent();
    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe('');
    expect(noticeIsShowing()).toBe(false);

    siblingSignedInAs('user-2');
    fireStorageEvent();
    expect(noticeIsShowing()).toBe(true);
  });

  it('ignores a theme write, which carries no news about anyone signing in', () => {
    renderLoginScreen();
    // a sibling toggling dark mode writes this key and a timestamp beside it
    siblingSignedInAs('user-2');
    fireStorageEvent('linklater_theme');
    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe('');
    expect(noticeIsShowing()).toBe(false);

    fireStorageEvent();
    expect(noticeIsShowing()).toBe(true);
  });

  it('reads a whole-store clear, which takes the token with it', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();
    expect(noticeIsShowing()).toBe(true);

    siblingSignedOut();
    fireStorageEvent(null);
    expect(noticeIsShowing()).toBe(false);
  });
});

describe('the sibling signs back out', () => {
  it('retracts the offer rather than leaving a link the gate bounces', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();
    expect(noticeIsShowing()).toBe(true);

    siblingSignedOut();
    fireStorageEvent();

    expect(noticeIsShowing()).toBe(false);
    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe('');
  });
});

describe('a boot that kept its token and failed its profile fetch', () => {
  it('offers the way back, which no storage event was ever going to', () => {
    sessionStorage.setItem(RENDERED_IDENTITY_KEY, 'user-1');
    siblingSignedInAs('user-1');

    renderLoginScreen();

    expect(noticeIsShowing()).toBe(true);
    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe(MESSAGE);
  });

  it('says nothing when this tab rendered nobody, which a sign-out looks like', () => {
    // logout forgets the identity, then clears the token a round trip later
    siblingSignedInAs('user-1');

    renderLoginScreen();

    expect(noticeIsShowing()).toBe(false);
    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe('');
  });

  it('says nothing when the token is gone, prior identity or not', () => {
    sessionStorage.setItem(RENDERED_IDENTITY_KEY, 'user-1');
    siblingSignedOut();

    renderLoginScreen();

    expect(noticeIsShowing()).toBe(false);
  });
});

describe('the action', () => {
  it('is a link, so it announces as one and keeps the browser gestures', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();

    expect(screen.getByRole('link', { name: ACTION })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: ACTION })).toBeNull();
  });

  it('points at the one destination the pending notice is consumed on', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();

    expect(screen.getByRole('link', { name: ACTION })).toHaveAttribute(
      'href',
      '/unread',
    );
  });
});
