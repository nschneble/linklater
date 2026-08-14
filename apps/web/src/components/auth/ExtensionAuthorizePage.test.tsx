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
import { ApiError, authorizeExtension } from '../../lib/api';
import ExtensionAuthorizePage from './ExtensionAuthorizePage';
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

const authorizeExtensionMock = authorizeExtension as Mock;

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

function errorNode(): HTMLElement {
  const node = document.getElementById(ERROR_ID);
  if (!node) throw new Error(`no #${ERROR_ID} in the document`);
  return node;
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
    authorizeExtensionMock.mockResolvedValue({ redirectUrl: CALLBACK_URL });
    renderPage();
    fireEvent.click(authorizeButton());

    await waitFor(() => {
      expect(authorizeExtensionMock).toHaveBeenCalledWith(
        CODE_CHALLENGE,
        REDIRECT_URI,
      );
    });
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

    const pending = screen.getByRole('status');
    expect(pending).toHaveTextContent('');

    fireEvent.click(authorizeButton());
    expect(pending).toHaveTextContent('Authorizing…');

    grant.reject(new ApiError('Bad gateway', 502));
    await waitFor(() => {
      expect(pending).toHaveTextContent('');
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

  it('describes the retry control by the failure, and by nothing at idle', async () => {
    authorizeExtensionMock.mockRejectedValue(new ApiError('Nope', 502));
    renderPage();
    expect(authorizeButton()).toHaveAccessibleDescription('');

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

describe('ExtensionAuthorizePage cancel', () => {
  it('hands the extension an explicit denial it can close its own window on', () => {
    renderPage();
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      `${REDIRECT_URI}?error=access_denied`,
    );
  });

  it('falls back in-app rather than forwarding a destination it cannot vouch for', () => {
    renderPage(
      `?code_challenge=${CODE_CHALLENGE}&redirect_uri=${encodeURIComponent('https://evil.example.com/steal')}`,
    );
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute(
      'href',
      '/unread',
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
