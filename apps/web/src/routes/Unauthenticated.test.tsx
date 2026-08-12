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
 * The other half of the claim is what happens when the offer IS followed
 * and the session behind it has gone: the document load is played by
 * unmounting this tree and standing a fresh one up, which is the only
 * shape in which a value that survived storage can be told apart from one
 * that merely survived a re-render.
 *
 * The route table is pinned separately in
 * `Unauthenticated.routes.test.tsx`, which needs `AuthForm` stubbed and so
 * cannot share a module-scoped mock with this file.
 *
 * The token store is real, and the tokens are minted rather than stubbed.
 * What the notice claims is a claim about what storage answers, so a
 * mocked `getStoredToken` would let this suite certify behavior the store
 * refutes: it keeps the copy this tab holds when a sibling's removal
 * empties the persisted one, which is why the offer cannot retract. A
 * sibling is therefore played the way the browser plays one, by writing
 * `localStorage` directly and delivering the `storage` event the writing
 * tab never sees.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthFormWrapper } from './Unauthenticated';
import { clearStoredToken, getStoredToken } from '../lib/api';
import { fireEvent, render, screen } from '@testing-library/react';
import { JwtService } from '@nestjs/jwt';
import { MemoryRouter } from 'react-router';
import { restoreLocation, standOnPath } from '../../test/locationMock';

vi.mock('../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// only the network calls behind the form; the token store stays real
vi.mock('../lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/api')>()),
  forgotPassword: vi.fn(),
  registerMagicLink: vi.fn(),
  requestMagicLink: vi.fn(),
  verifyOtp: vi.fn(),
}));

import { useAuth } from '../auth/AuthContext';

const ACTION = 'Go to your links';
const ANNOUNCEMENT = 'already-signed-in-announcement';
const BOUNCE_MESSAGE =
  "We couldn't reopen that session, so please sign in again";
const MESSAGE = "You're already signed in.";
const PENDING_ANNOUNCEMENT = 'pending-notice-announcement';
const RENDERED_IDENTITY_KEY = 'linklater_rendered_identity';
const TOKEN_KEY = 'linklater_token';

let assignMock: ReturnType<typeof vi.fn>;

/**
 * A token the real reader can decode, signed the way the API signs.
 * `exp` is passed rather than left to `expiresIn` so a test can date a
 * token in the past, which is the state a failed boot cannot tell from a
 * network blip.
 */
function mintToken(subject: string, secondsUntilExpiry: number | null): string {
  const expiry =
    secondsUntilExpiry === null
      ? {}
      : { exp: Math.floor(Date.now() / 1000) + secondsUntilExpiry };
  return new JwtService({ secret: 'notice-test-secret' }).sign({
    subject,
    email: 'user@example.com',
    ...expiry,
  });
}

function siblingWrote(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

function siblingSignedInAs(subject: string) {
  siblingWrote(mintToken(subject, 3600));
}

function siblingSignedOut() {
  window.localStorage.removeItem(TOKEN_KEY);
}

function fireStorageEvent(key: string | null = TOKEN_KEY) {
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
  localStorage.clear();
  // the store keeps an in-memory copy no outside write can reach
  clearStoredToken();
  assignMock = standOnPath();
  vi.mocked(useAuth).mockReturnValue({
    login: vi.fn(),
    refreshUser: vi.fn(),
    register: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
});

afterEach(() => {
  restoreLocation();
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
    // an opaque `ltk_` API token carries no readable payload
    siblingWrote('ltk_0f8d1c2e4a6b4f21');
    fireStorageEvent();
    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe('');
    expect(noticeIsShowing()).toBe(false);

    siblingSignedInAs('user-2');
    fireStorageEvent();
    expect(noticeIsShowing()).toBe(true);
  });

  it('ignores a token that arrives already expired', () => {
    renderLoginScreen();
    siblingWrote(mintToken('user-2', -60));
    fireStorageEvent();
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
});

describe('the sibling signs back out', () => {
  it('leaves the offer standing, since the token store keeps its copy', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();
    expect(noticeIsShowing()).toBe(true);

    siblingSignedOut();
    fireStorageEvent();

    expect(noticeIsShowing()).toBe(true);
    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe(MESSAGE);
  });

  it('is the store answering, not the notice ignoring the event', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();

    siblingSignedOut();
    fireStorageEvent();

    // reading the same way the followed link would, through the store
    expect(getStoredToken()).not.toBeNull();
  });
});

describe('an offer already on screen', () => {
  it('stays up when a later event carries a token that has run out', () => {
    renderLoginScreen();
    siblingSignedInAs('user-2');
    fireStorageEvent();
    expect(noticeIsShowing()).toBe(true);

    siblingWrote(mintToken('user-2', -60));
    fireStorageEvent();

    expect(noticeIsShowing()).toBe(true);
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

  it('says nothing when the token it kept had already run out', () => {
    // the arm this feeds is a boot whose fetch failed without a 401
    sessionStorage.setItem(RENDERED_IDENTITY_KEY, 'user-1');
    siblingWrote(mintToken('user-1', -60));

    renderLoginScreen();

    expect(noticeIsShowing()).toBe(false);
    expect(screen.getByTestId(ANNOUNCEMENT).textContent).toBe('');
  });

  it('offers on a token carrying no expiry, which is nothing to date it by', () => {
    sessionStorage.setItem(RENDERED_IDENTITY_KEY, 'user-1');
    siblingWrote(mintToken('user-1', null));

    renderLoginScreen();

    expect(noticeIsShowing()).toBe(true);
  });
});

describe('the offer is taken and the session turns out to be gone', () => {
  /**
   * The link is a full document load, so the bounce is played the way the
   * browser plays it: this tree goes away and the auth gate stands a new
   * one up. The token is cleared in between, which is what a 401 on the
   * way in does.
   */
  function bounceBackToLogin(standing: ReturnType<typeof renderLoginScreen>) {
    fireEvent.click(screen.getByRole('link', { name: ACTION }));
    standing.unmount();
    localStorage.clear();
    clearStoredToken();
    return renderLoginScreen();
  }

  function typeInto(field: RegExp, value: string) {
    fireEvent.change(screen.getByLabelText(field), { target: { value } });
  }

  function offerIsUp() {
    sessionStorage.setItem(RENDERED_IDENTITY_KEY, 'user-1');
    siblingSignedInAs('user-1');
    const standing = renderLoginScreen();
    expect(noticeIsShowing()).toBe(true);
    return standing;
  }

  it('hands the typed email back rather than demanding it again', () => {
    const standing = offerIsUp();
    typeInto(/email/i, 'half-typed@example.com');

    bounceBackToLogin(standing);

    expect(screen.getByLabelText(/email/i)).toHaveValue(
      'half-typed@example.com',
    );
  });

  it('says why the form is being asked for a second time', () => {
    const standing = offerIsUp();

    bounceBackToLogin(standing);

    expect(screen.getByTestId(PENDING_ANNOUNCEMENT).textContent).toBe(
      BOUNCE_MESSAGE,
    );
    expect(screen.getAllByText(BOUNCE_MESSAGE).length).toBeGreaterThan(0);
  });

  it('announces into a form nothing has focused', () => {
    const standing = offerIsUp();

    bounceBackToLogin(standing);

    expect(screen.getByLabelText(/email/i)).not.toBe(document.activeElement);
    expect(screen.getByLabelText(/password/i)).not.toBe(document.activeElement);
  });

  it('carries an empty box, since the arrival has to speak either way', () => {
    const standing = offerIsUp();

    bounceBackToLogin(standing);

    expect(screen.getByLabelText(/email/i)).toHaveValue('');
    expect(screen.getByTestId(PENDING_ANNOUNCEMENT).textContent).toBe(
      BOUNCE_MESSAGE,
    );
  });

  it('leaves the password behind, which no document should be storing', () => {
    const standing = offerIsUp();
    typeInto(/email/i, 'half-typed@example.com');
    typeInto(/password/i, 'still-typing');

    bounceBackToLogin(standing);

    expect(screen.getByLabelText(/password/i)).toHaveValue('');
  });

  it('speaks once, so reloading the form it landed on says nothing', () => {
    const bounced = bounceBackToLogin(offerIsUp());
    expect(screen.getByTestId(PENDING_ANNOUNCEMENT).textContent).toBe(
      BOUNCE_MESSAGE,
    );

    bounced.unmount();
    renderLoginScreen();

    expect(screen.getByTestId(PENDING_ANNOUNCEMENT).textContent).toBe('');
    expect(screen.getByLabelText(/email/i)).toHaveValue('');
  });

  it('carries nothing off a form whose offer was never followed', () => {
    const standing = offerIsUp();
    typeInto(/email/i, 'half-typed@example.com');

    standing.unmount();
    localStorage.clear();
    clearStoredToken();
    renderLoginScreen();

    expect(screen.getByLabelText(/email/i)).toHaveValue('');
    expect(screen.getByTestId(PENDING_ANNOUNCEMENT).textContent).toBe('');
  });
});

describe('the form under a standing offer', () => {
  it('focuses nothing, so the polite region is not read into forms mode', () => {
    sessionStorage.setItem(RENDERED_IDENTITY_KEY, 'user-1');
    siblingSignedInAs('user-1');

    renderLoginScreen();

    expect(noticeIsShowing()).toBe(true);
    expect(screen.getByLabelText(/email/i)).not.toBe(document.activeElement);
  });

  it('focuses the email input when no offer is standing', () => {
    renderLoginScreen();

    expect(noticeIsShowing()).toBe(false);
    expect(screen.getByLabelText(/email/i)).toBe(document.activeElement);
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
