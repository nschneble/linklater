/**
 * Tests for the unauthenticated shell around the login form.
 *
 * The real `AuthForm` and the real `useAuthForm` render here on purpose.
 * The claim under test is that a sibling tab signing in leaves this tab's
 * half-filled form alone, and only a form whose state is genuinely
 * component-local can prove that; a mocked hook would hold the email in
 * the test instead of in the component that is supposed to lose it.
 */

import { AuthFormWrapper } from './Unauthenticated';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../lib/api', () => ({
  forgotPassword: vi.fn(),
  getStoredToken: vi.fn(),
  readTokenClaims: vi.fn(),
  registerMagicLink: vi.fn(),
  requestMagicLink: vi.fn(),
  verifyOtp: vi.fn(),
}));

import * as apiModule from '../lib/api';
import { useAuth } from '../auth/AuthContext';

const ANNOUNCEMENT = 'already-signed-in-announcement';

function siblingSignedInAs(subject: string | null) {
  vi.mocked(apiModule.getStoredToken).mockReturnValue('sibling-jwt');
  vi.mocked(apiModule.readTokenClaims).mockReturnValue(
    subject === null ? null : { exp: null, sub: subject },
  );
}

function fireStorageEvent() {
  fireEvent(window, new StorageEvent('storage', { key: 'linklater_token' }));
}

/** The painted copy of the message, as opposed to the sr-only mirror. */
function visibleNotice(): HTMLElement {
  const painted = screen
    .getAllByText("You're signed in on another tab.")
    .find((element) => element.closest('.sr-only') === null);
  if (!painted) throw new Error('no visible notice rendered');
  return painted;
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
  vi.mocked(useAuth).mockReturnValue({
    login: vi.fn(),
    refreshUser: vi.fn(),
    register: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
  vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
  vi.mocked(apiModule.readTokenClaims).mockReturnValue(null);
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

  it('shows no notice while nobody is signed in elsewhere', () => {
    renderLoginScreen();
    expect(screen.queryByRole('button', { name: 'Go to my links' })).toBeNull();
  });
});

describe('a sibling tab signs in', () => {
  it('populates the live region, which is the transition SRs announce', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();

    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe(
      "You're signed in on another tab.",
    );
  });

  it('surfaces a visible notice carrying the same words as the region', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();

    // both channels, one string: they cannot drift apart
    expect(
      screen.getAllByText("You're signed in on another tab."),
    ).toHaveLength(2);
    expect(visibleNotice()).toBeInTheDocument();
  });

  it('offers an action rather than taking it', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();

    expect(
      screen.getByRole('button', { name: 'Go to my links' }),
    ).toBeInTheDocument();
  });

  it('leaves the typed email in place (WCAG 3.3.7 Redundant Entry)', () => {
    renderLoginScreen();
    const email = screen.getByLabelText(/email/i);
    fireEvent.change(email, { target: { value: 'half-typed@example.com' } });

    siblingSignedInAs('user-2');
    fireStorageEvent();

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

    expect(screen.getByLabelText(/password/i)).toHaveValue('still-typing');
  });

  it('leaves the login form standing rather than replacing it', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('never moves focus off the field the caret was in', () => {
    renderLoginScreen();
    const password = screen.getByLabelText(/password/i);
    password.focus();

    siblingSignedInAs('user-2');
    fireStorageEvent();

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

      expect(
        screen.getByRole('button', { name: 'Go to my links' }),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('storage changes that are not a sibling signing in', () => {
  it('ignores a storage event that leaves no token behind', () => {
    renderLoginScreen();
    vi.mocked(apiModule.getStoredToken).mockReturnValue(null);
    fireStorageEvent();

    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe('');
  });

  it('ignores a token whose owner cannot be read', () => {
    renderLoginScreen();
    siblingSignedInAs(null);
    fireStorageEvent();

    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe('');
    expect(screen.queryByRole('button', { name: 'Go to my links' })).toBeNull();
  });
});

describe('activating the notice', () => {
  it('replaces the document, so the app boots fresh under the new identity', () => {
    const realLocation = window.location;
    const assignMock = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...realLocation, assign: assignMock },
      writable: true,
    });

    try {
      renderLoginScreen();
      siblingSignedInAs('user-2');
      fireStorageEvent();

      fireEvent.click(screen.getByRole('button', { name: 'Go to my links' }));

      expect(assignMock).toHaveBeenCalledWith('/unread');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: realLocation,
        writable: true,
      });
    }
  });
});
