/*
 * Tests for ExtensionAuthorizePage, the extension consent screen.
 *
 * The page's whole reason for changing is that a top-level navigation
 * carries no Authorization header, so what is pinned here is that the
 * grant goes out through `authorizeExtension` and the navigation happens
 * afterwards, to the URL the server chose. Whether the server accepts an
 * unauthenticated caller is not observable from here at all;
 * `extension-auth.guard.spec.ts` is where that lives.
 *
 * Host-bundle contract: the Authorize PrimaryButton keeps surface="mount"
 * (the default) so it tiers against the --mount-bg card; this pins the
 * default so a refactor can't silently override it to the wrong surface.
 *
 * Each dynamic state is pinned in both directions. The pending region
 * fills and empties, the error sets and clears, and the in-flight guard
 * is checked against the click it is supposed to swallow, because the
 * forward half of any of those passes on its own while the state it
 * leaves behind is wrong.
 *
 * The account check is pinned on both of its arms, since they answer
 * different questions: the subscription decides what the page displays,
 * and the handler decides whether a grant goes out at all. A suite that
 * only ever announced through the subscription would pass while the one
 * that matters, a tab no event reached, granted on the wrong account.
 *
 * The grant is reset rather than cleared between tests. Clearing keeps the
 * queue of single-use outcomes, so a deferred grant a test never consumed
 * would go on to decide the next one, which is how a test that fails here
 * can pass on its own.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import {
  ApiError,
  authorizeExtension,
  clearStoredToken,
  setStoredToken,
} from '../../lib/api';
import ExtensionAuthorizePage from './ExtensionAuthorizePage';
import { extensionDenialUrl } from './extensionDenialUrl';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { restoreLocation, standOnPath } from '../../../test/locationMock';
import type { User } from '../../auth/AuthContext';

vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, authorizeExtension: vi.fn() };
});

const SIGNED_IN_USER = {
  email: 'alice@example.com',
  userId: 'user-1',
} as User;

let currentUser: User | null = SIGNED_IN_USER;

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: currentUser }),
}));

const CODE_CHALLENGE = 'sha256-challenge-abc';
const REDIRECT_URI = 'chrome-extension://abc/callback';
const CALLBACK_URL = `${REDIRECT_URI}?code=auth-code-123`;

const ERROR_ID = 'extension-authorize-error';
const CHANGED_ID = 'extension-account-changed';

const authorizeExtensionMock = authorizeExtension as Mock;

/**
 * Tokens the store can actually read a subject out of. `user-1` is the
 * account the page renders; `user-2` is the sibling tab signing in.
 */
function makeToken(subject: string): string {
  const segment = btoa(JSON.stringify({ subject, exp: 4102444800 }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  return `header.${segment}.signature`;
}

const ALICE_TOKEN = makeToken('user-1');
const BOB_TOKEN = makeToken('user-2');

/** A sibling tab's write, as this tab receives it. */
function signInElsewhere(token: string, key = 'linklater_token') {
  setStoredToken(token);
  fireEvent(window, new StorageEvent('storage', { key }));
}

function renderPage(
  search = `?code_challenge=${CODE_CHALLENGE}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`,
) {
  return render(
    <MemoryRouter initialEntries={[`/extension/authorize${search}`]}>
      <ExtensionAuthorizePage />
    </MemoryRouter>,
  );
}

function authorizeButton(): HTMLElement {
  return screen.getByRole('button', { name: /authoriz/i });
}

function nodeById(id: string): HTMLElement {
  const node = document.getElementById(id);
  if (!node) throw new Error(`no #${id} in the document`);
  return node;
}

function errorNode(): HTMLElement {
  return nodeById(ERROR_ID);
}

/*
 * Two polite regions now sit on this page, so neither is reachable by
 * role alone. Both carry a test hook: the pending one has no text to
 * find it by while it is empty, and the account-changed one is a wrapper
 * whose own text belongs to the two paragraphs inside it.
 */
function pendingNode(): HTMLElement {
  return screen.getByTestId('extension-authorize-pending');
}

/*
 * The live region is mounted from the first paint so it is registered
 * before it fills, which means its presence settles nothing. Waiting for
 * a failure is waiting for its text.
 */
async function findFailure(): Promise<HTMLElement> {
  await waitFor(() => {
    expect(errorNode().textContent).not.toBe('');
  });
  return errorNode();
}

/** A grant whose outcome the test decides, one tick at a time. */
function deferGrant(): {
  reject: (caught: unknown) => void;
  resolve: (redirectUrl: string) => void;
} {
  let settle: {
    reject: (caught: unknown) => void;
    resolve: (value: { redirectUrl: string }) => void;
  };
  authorizeExtensionMock.mockReturnValueOnce(
    new Promise<{ redirectUrl: string }>((resolve, reject) => {
      settle = { reject, resolve };
    }),
  );
  return {
    reject: (caught: unknown) => settle.reject(caught),
    resolve: (redirectUrl: string) => settle.resolve({ redirectUrl }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authorizeExtensionMock.mockReset();
  currentUser = SIGNED_IN_USER;
  localStorage.clear();
  clearStoredToken();
  standOnPath('/extension/authorize');
});

afterEach(() => {
  restoreLocation();
});

describe('ExtensionAuthorizePage', () => {
  it('titles the document, which no branch of this route used to do', () => {
    renderPage();
    expect(document.title).toBe('Linklater – Authorize extension');
  });

  it('exposes a main landmark, as every other Common route does', () => {
    renderPage();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  // unpinned, a Custom theme drops the alert's contrast under AA
  it('pins branding, so no saved palette reaches the gradient', () => {
    renderPage();
    expect(screen.getByRole('main')).toHaveAttribute('data-theme', 'branding');
  });

  it('Authorize PrimaryButton declares surface="mount" – card is --mount-bg (default)', () => {
    renderPage();
    expect(authorizeButton().getAttribute('data-surface')).toBe('mount');
  });

  it('sends the grant through the API client, not a top-level navigation', async () => {
    setStoredToken(ALICE_TOKEN);
    authorizeExtensionMock.mockResolvedValue({ redirectUrl: CALLBACK_URL });
    renderPage();
    fireEvent.click(authorizeButton());

    await waitFor(() => {
      expect(authorizeExtensionMock).toHaveBeenCalledWith(
        CODE_CHALLENGE,
        REDIRECT_URI,
        ALICE_TOKEN,
      );
    });
  });

  /*
   * The token travels with the grant rather than being looked up again
   * inside it. What `index.test.ts` proves is that a literal suppresses
   * the renewal and the retry; what this proves is that the page hands
   * one over at all, which is the half the client cannot do for itself.
   */
  it('pins the grant to the token it checked, never to a later read', async () => {
    setStoredToken(ALICE_TOKEN);
    const grant = deferGrant();
    renderPage();
    fireEvent.click(authorizeButton());

    setStoredToken(BOB_TOKEN);
    expect(authorizeExtensionMock).toHaveBeenCalledWith(
      CODE_CHALLENGE,
      REDIRECT_URI,
      ALICE_TOKEN,
    );

    grant.reject(new ApiError('Bad gateway', 502));
    await findFailure();
  });

  it('navigates to the URL the server chose, never one it assembled itself', async () => {
    authorizeExtensionMock.mockResolvedValue({ redirectUrl: CALLBACK_URL });
    renderPage();
    fireEvent.click(authorizeButton());

    await waitFor(() => {
      expect(window.location.href).toBe(CALLBACK_URL);
    });
  });

  it('holds the pending label across the navigation rather than repainting as ready', async () => {
    const grant = deferGrant();
    renderPage();
    fireEvent.click(authorizeButton());

    grant.resolve(CALLBACK_URL);
    await waitFor(() => {
      expect(window.location.href).toBe(CALLBACK_URL);
    });
    expect(authorizeButton()).toHaveTextContent('Authorizing…');
  });
});

describe('ExtensionAuthorizePage pending state', () => {
  it('announces the grant is in flight, and stops once it fails', async () => {
    const grant = deferGrant();
    renderPage();

    expect(pendingNode()).toHaveTextContent('');

    fireEvent.click(authorizeButton());
    expect(pendingNode()).toHaveTextContent('Authorizing…');

    grant.reject(new ApiError('Bad gateway', 502));
    await waitFor(() => {
      expect(pendingNode()).toHaveTextContent('');
    });
  });

  it('marks the control pending and un-marks it, without ever removing it', async () => {
    const grant = deferGrant();
    renderPage();

    fireEvent.click(authorizeButton());
    expect(authorizeButton()).toHaveAttribute('aria-disabled', 'true');

    grant.reject(new ApiError('Bad gateway', 502));
    await waitFor(() => {
      expect(authorizeButton()).toHaveAttribute('aria-disabled', 'false');
    });
  });

  // aria-busy would defer the label change it is the only candidate for
  it('never asks a reader to defer the one update the control exposes', async () => {
    const grant = deferGrant();
    renderPage();

    fireEvent.click(authorizeButton());
    expect(authorizeButton()).not.toHaveAttribute('aria-busy');

    grant.reject(new ApiError('Bad gateway', 502));
    await findFailure();
  });

  it('keeps the pending control focusable, so focus is never dropped to body', async () => {
    const grant = deferGrant();
    renderPage();

    authorizeButton().focus();
    fireEvent.click(authorizeButton());

    expect(authorizeButton()).not.toBeDisabled();
    expect(document.activeElement).toBe(authorizeButton());

    grant.reject(new ApiError('Bad gateway', 502));
    await findFailure();
  });

  it('swallows a second activation while the first grant is out', async () => {
    const grant = deferGrant();
    renderPage();

    fireEvent.click(authorizeButton());
    fireEvent.click(authorizeButton());

    await waitFor(() => {
      expect(authorizeExtensionMock).toHaveBeenCalledTimes(1);
    });

    grant.reject(new ApiError('Bad gateway', 502));
    await findFailure();
  });
});

describe('ExtensionAuthorizePage failures', () => {
  it.each([
    [502, "We couldn't authorize the extension right now. Please try again."],
    [429, "We couldn't authorize the extension right now. Please try again."],
    [
      401,
      "You're no longer signed in. Sign in again, then start over from the extension.",
    ],
    [
      400,
      "We couldn't read the request the extension sent. Close this tab and start again from the extension.",
    ],
  ])(
    'explains a %i without quoting the server back at the user',
    async (status, message) => {
      authorizeExtensionMock.mockRejectedValue(
        new ApiError('Invalid redirect_uri', status),
      );
      renderPage();
      fireEvent.click(authorizeButton());

      const alert = await findFailure();
      expect(alert).toHaveTextContent(message);
      expect(alert).not.toHaveTextContent('Invalid redirect_uri');
    },
  );

  it('explains a rejection that is not an ApiError at all', async () => {
    authorizeExtensionMock.mockRejectedValue(new TypeError('Failed to fetch'));
    renderPage();
    fireEvent.click(authorizeButton());

    expect(await findFailure()).toHaveTextContent(
      "We couldn't authorize the extension right now.",
    );
  });

  it('empties the message on retry, so an identical second failure is heard', async () => {
    authorizeExtensionMock.mockRejectedValue(new ApiError('Nope', 502));
    renderPage();
    fireEvent.click(authorizeButton());
    await findFailure();

    const retry = deferGrant();
    fireEvent.click(authorizeButton());
    expect(screen.getByRole('alert')).toBe(errorNode());
    expect(errorNode()).toHaveTextContent('');

    retry.reject(new ApiError('Nope', 502));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        "We couldn't authorize the extension right now.",
      );
    });
  });

  // three empty regions are still joined by two spaces, which is no text
  it('describes the retry control by the failure, and by nothing at idle', async () => {
    authorizeExtensionMock.mockRejectedValue(new ApiError('Nope', 502));
    renderPage();
    expect(authorizeButton()).toHaveAccessibleDescription(/^\s*$/);

    fireEvent.click(authorizeButton());

    await waitFor(() => {
      expect(authorizeButton()).toHaveAccessibleDescription(
        /We couldn't authorize the extension right now/,
      );
    });
  });

  it('stops naming the account once the session behind it is gone', async () => {
    authorizeExtensionMock.mockRejectedValue(new ApiError('Unauthorized', 401));
    renderPage();
    expect(screen.getByText(SIGNED_IN_USER.email)).toBeInTheDocument();

    fireEvent.click(authorizeButton());

    await waitFor(() => {
      expect(screen.queryByText(SIGNED_IN_USER.email)).toBeNull();
    });
  });

  it('keeps naming the account when the session is not what failed', async () => {
    authorizeExtensionMock.mockRejectedValue(new ApiError('Bad gateway', 502));
    renderPage();
    fireEvent.click(authorizeButton());

    await findFailure();
    expect(screen.getByText(SIGNED_IN_USER.email)).toBeInTheDocument();
  });

  it('leaves focus on the button that is also the retry', async () => {
    authorizeExtensionMock.mockRejectedValue(new ApiError('Nope', 502));
    renderPage();
    authorizeButton().focus();
    fireEvent.click(authorizeButton());

    await findFailure();
    expect(document.activeElement).toBe(authorizeButton());
  });
});

/*
 * The account the screen names and the account it would grant on are the
 * same one, or there is no grant. Both arms are pinned: the subscription
 * that keeps the display honest, and the click that refuses whether or
 * not the subscription ever heard anything.
 */
describe('ExtensionAuthorizePage account switched underneath it', () => {
  function changedNode(): HTMLElement {
    return nodeById(CHANGED_ID);
  }

  it('says so once a sibling tab signs in as somebody else', () => {
    setStoredToken(ALICE_TOKEN);
    renderPage();
    expect(changedNode()).toHaveTextContent('');

    signInElsewhere(BOB_TOKEN);
    expect(changedNode()).toHaveTextContent(
      'This tab is now signed in to a different account.',
    );
  });

  /*
   * A tab that opened after the switch heard no event, and the route is
   * left out of the identity guard, so first paint is the only chance
   * this arm gets to notice.
   */
  it('notices a token that already belonged to somebody else', () => {
    setStoredToken(BOB_TOKEN);
    renderPage();

    expect(changedNode()).toHaveTextContent(
      'This tab is now signed in to a different account.',
    );
    expect(screen.queryByText(SIGNED_IN_USER.email)).toBeNull();
  });

  // assertive is for a verdict the user is waiting on; nobody waits here
  it('speaks the statement and the errand as one polite announcement', () => {
    setStoredToken(ALICE_TOKEN);
    renderPage();

    const region = screen.getByTestId('extension-account-changed-region');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toContainElement(changedNode());
    expect(region).toContainElement(nodeById('extension-account-changed-next'));
    // a root inside the root is where one utterance quietly becomes two
    expect(
      region.querySelectorAll('[aria-live], [role="status"]'),
    ).toHaveLength(0);
  });

  it('stays quiet when the sibling rotated the same account', () => {
    setStoredToken(ALICE_TOKEN);
    renderPage();

    signInElsewhere(ALICE_TOKEN);
    expect(changedNode()).toHaveTextContent('');
  });

  // unfiltered, a sibling's dark-mode toggle would fire the region
  it('ignores a storage write that is not the token pair', () => {
    setStoredToken(ALICE_TOKEN);
    renderPage();

    signInElsewhere(BOB_TOKEN, 'linklater_theme');
    expect(changedNode()).toHaveTextContent('');
  });

  it('takes the offer back when the user switches back', () => {
    setStoredToken(ALICE_TOKEN);
    renderPage();

    signInElsewhere(BOB_TOKEN);
    signInElsewhere(ALICE_TOKEN);

    expect(changedNode()).toHaveTextContent('');
    expect(authorizeButton()).toHaveAttribute('aria-disabled', 'false');
  });

  it('stops naming an account it can no longer grant on', () => {
    setStoredToken(ALICE_TOKEN);
    renderPage();
    expect(screen.getByText(SIGNED_IN_USER.email)).toBeInTheDocument();

    signInElsewhere(BOB_TOKEN);
    expect(screen.queryByText(SIGNED_IN_USER.email)).toBeNull();
  });

  it('marks the control inoperable in the same commit', () => {
    setStoredToken(ALICE_TOKEN);
    renderPage();

    signInElsewhere(BOB_TOKEN);
    expect(authorizeButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('refuses the grant the marked control still accepts a click on', () => {
    setStoredToken(ALICE_TOKEN);
    renderPage();

    signInElsewhere(BOB_TOKEN);
    fireEvent.click(authorizeButton());

    expect(authorizeExtensionMock).not.toHaveBeenCalled();
  });

  /*
   * The gate is the handler, never the announcement. This route is left
   * out of the identity guard on purpose, so a tab that missed the event
   * has nothing else standing between it and a grant on the wrong
   * account.
   */
  it('refuses on a token switch it was never told about', () => {
    setStoredToken(ALICE_TOKEN);
    renderPage();

    setStoredToken(BOB_TOKEN);
    fireEvent.click(authorizeButton());

    expect(authorizeExtensionMock).not.toHaveBeenCalled();
    expect(changedNode()).toHaveTextContent(
      'This tab is now signed in to a different account.',
    );
    expect(authorizeButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('never claims a grant is in flight for one that never left', () => {
    setStoredToken(ALICE_TOKEN);
    renderPage();

    setStoredToken(BOB_TOKEN);
    fireEvent.click(authorizeButton());

    expect(pendingNode()).toHaveTextContent('');
    expect(authorizeButton()).toHaveTextContent('Authorize');
  });

  it('keeps the control mounted and holding focus through the refusal', () => {
    setStoredToken(ALICE_TOKEN);
    renderPage();
    authorizeButton().focus();

    signInElsewhere(BOB_TOKEN);
    fireEvent.click(authorizeButton());

    expect(authorizeButton()).toBeInTheDocument();
    expect(document.activeElement).toBe(authorizeButton());
  });

  // anchored, because what is pinned here is the order, not the presence
  it('describes the control by the precondition ahead of any verdict', () => {
    setStoredToken(ALICE_TOKEN);
    renderPage();

    signInElsewhere(BOB_TOKEN);
    expect(authorizeButton()).toHaveAccessibleDescription(
      /^This tab is now signed in to a different account\. Close this tab and start again from the extension\.\s*$/,
    );
  });

  it('leaves a standing precondition where a click cannot erase it', async () => {
    setStoredToken(ALICE_TOKEN);
    authorizeExtensionMock.mockRejectedValue(new ApiError('Nope', 502));
    renderPage();
    fireEvent.click(authorizeButton());
    await findFailure();

    signInElsewhere(BOB_TOKEN);
    fireEvent.click(authorizeButton());

    expect(changedNode()).toHaveTextContent(
      'This tab is now signed in to a different account.',
    );
  });
});

describe('ExtensionAuthorizePage cancel', () => {
  it('sends the refusal to the endpoint holding the allowlist', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      extensionDenialUrl(REDIRECT_URI),
    );
  });

  it('keeps an operable control for a destination the server will refuse', () => {
    renderPage(
      `?code_challenge=${CODE_CHALLENGE}&redirect_uri=${encodeURIComponent('https://evil.example.com/steal')}`,
    );

    // an anchor with no href is not a link and cannot be reached by Tab
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
    );
  });
});

describe('ExtensionAuthorizePage arrival without a request', () => {
  it('replaces the prompt instead of offering a grant that cannot be made', () => {
    renderPage('');

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't read the request the extension sent.",
    );
  });

  it('replaces the prompt when only the challenge is missing', () => {
    renderPage(`?redirect_uri=${encodeURIComponent(REDIRECT_URI)}`);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't read the request the extension sent.",
    );
  });

  // the consent branch mounts a region too, so emptiness is the tell
  it('offers the grant when both parameters are present', () => {
    renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('');
    expect(authorizeButton()).toBeInTheDocument();
  });

  it('takes focus, since the branch renders nothing else focusable', () => {
    renderPage('');
    expect(document.activeElement).toBe(screen.getByRole('alert'));
  });
});

describe('ExtensionAuthorizePage signed out', () => {
  beforeEach(() => {
    currentUser = null;
  });

  it('offers sign in rather than a consent prompt', () => {
    renderPage();

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('paints the sign in link from the shared primary action classes', () => {
    renderPage();
    const link = screen.getByRole('link', { name: 'Sign in' });

    expect(link.className).toContain('rounded-full');
    expect(link.className).toContain('hover:bg-[var(--mount-highlight-hover)]');
  });
});
