/**
 * Tests for SavePage (the public `/save?url=` route).
 *
 * On mount, an authenticated visitor with a `?url=` saves via createLink and is
 * returned to their source with the least UI:
 *   - script-opened tab (window.opener) → window.close()
 *   - history has a prior entry → history.back()
 *   - nothing to return to → landing state ("Saved" / "Already saved…")
 * No `?url=` → the needUrl state. A failed save → the error state with a
 * focused recovery link and an assertive alert.
 */

import SavePage from './SavePage';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  createLink: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../lib/pendingSave', () => ({
  clearPendingSave: vi.fn(),
  setPendingSave: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import * as apiModule from '../../lib/api';
import { useAuth } from '../../auth/AuthContext';
import { clearPendingSave, setPendingSave } from '../../lib/pendingSave';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const closeMock = vi.fn();
const backMock = vi.fn();

function setAuthenticated() {
  vi.mocked(useAuth).mockReturnValue({
    user: { userId: 'user-1' },
  } as unknown as ReturnType<typeof useAuth>);
}

function setLoggedOut() {
  vi.mocked(useAuth).mockReturnValue({
    user: null,
  } as unknown as ReturnType<typeof useAuth>);
}

function setHistoryLength(length: number) {
  Object.defineProperty(window.history, 'length', {
    configurable: true,
    get: () => length,
  });
}

function setOpener(opener: unknown) {
  Object.defineProperty(window, 'opener', {
    configurable: true,
    writable: true,
    value: opener,
  });
}

async function renderSavePage(url?: string) {
  const entry = url ? `/save?url=${encodeURIComponent(url)}` : '/save';
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[entry]}>
        <SavePage />
      </MemoryRouter>,
    );
  });
}

// The logged-out branch renders <Navigate to="/login">, which only settles
// when SavePage is mounted inside a route table so the redirect can unmount it
// (as it is in the real app). Rendering SavePage bare would loop forever.
async function renderLoggedOutSavePage(url?: string) {
  const entry = url ? `/save?url=${encodeURIComponent(url)}` : '/save';
  await act(async () => {
    render(
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/save" element={<SavePage />} />
          <Route path="/login" element={<div>Login</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  closeMock.mockReset();
  backMock.mockReset();
  setAuthenticated();
  setOpener(null);
  setHistoryLength(1);
  window.close = closeMock;
  window.history.back = backMock;
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SavePage without a url', () => {
  it('renders the needUrl state and never calls createLink', async () => {
    await renderSavePage();

    expect(
      screen.getByRole('heading', { name: 'No link to save.' }),
    ).toBeInTheDocument();
    expect(apiModule.createLink).not.toHaveBeenCalled();
  });
});

describe('SavePage with a url', () => {
  it('calls createLink with the url from the query string', async () => {
    vi.mocked(apiModule.createLink).mockReturnValue(new Promise(() => {}));

    await renderSavePage('https://example.com/article');

    await waitFor(() => {
      expect(apiModule.createLink).toHaveBeenCalledWith({
        url: 'https://example.com/article',
      });
    });
  });
});

describe('SavePage success with nothing to return to', () => {
  it('shows the landing state with a "View reading list" link', async () => {
    vi.mocked(apiModule.createLink).mockResolvedValue({
      id: 'link-1',
      url: 'https://example.com/article',
      createdAt: '',
      updatedAt: '',
      status: 'created',
    });

    await renderSavePage('https://example.com/article');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Saved' }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByRole('link', { name: 'View reading list' }),
    ).toBeInTheDocument();
    expect(backMock).not.toHaveBeenCalled();
  });

  it('announces the landing outcome politely without moving focus', async () => {
    vi.mocked(apiModule.createLink).mockResolvedValue({
      id: 'link-1',
      url: 'https://example.com/article',
      createdAt: '',
      updatedAt: '',
      status: 'created',
    });

    await renderSavePage('https://example.com/article');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Saved' }),
      ).toBeInTheDocument();
    });
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Saved');
    expect(status).toHaveClass('sr-only');
    // Success landing keeps focus where it is (no interstitial).
    expect(document.activeElement).toBe(document.body);
  });

  it('shows the resurfaced copy when status is "resurfaced"', async () => {
    vi.mocked(apiModule.createLink).mockResolvedValue({
      id: 'link-1',
      url: 'https://example.com/article',
      createdAt: '',
      updatedAt: '',
      status: 'resurfaced',
    });

    await renderSavePage('https://example.com/article');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Already saved. Moved to top' }),
      ).toBeInTheDocument();
    });
  });
});

describe('SavePage success with history to return to', () => {
  it('calls history.back() and does not show a landing heading', async () => {
    setHistoryLength(3);
    vi.mocked(apiModule.createLink).mockResolvedValue({
      id: 'link-1',
      url: 'https://example.com/article',
      createdAt: '',
      updatedAt: '',
      status: 'created',
    });

    await renderSavePage('https://example.com/article');

    await waitFor(() => {
      expect(backMock).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByRole('heading', { name: 'Saved' })).toBeNull();
  });
});

describe('SavePage when auth re-emits mid-save', () => {
  it('still leaves the saving state after the auth user identity changes while the POST is in flight', async () => {
    let resolveCreate!: (
      link: Awaited<ReturnType<typeof apiModule.createLink>>,
    ) => void;
    const pending = new Promise<
      Awaited<ReturnType<typeof apiModule.createLink>>
    >((resolve) => {
      resolveCreate = resolve;
    });
    vi.mocked(apiModule.createLink).mockReturnValue(pending);

    let rerender!: ReturnType<typeof render>['rerender'];
    await act(async () => {
      ({ rerender } = render(
        <MemoryRouter initialEntries={['/save?url=https%3A%2F%2Fexample.com']}>
          <SavePage />
        </MemoryRouter>,
      ));
    });

    await waitFor(() => {
      expect(apiModule.createLink).toHaveBeenCalledTimes(1);
    });

    // The documented visibility refresh mints a brand new user object with the
    // same id, changing the save effect's `user` dependency mid-POST. The old
    // per-run cleanup flag cancelled the in-flight result commit here, so the
    // resolved POST could never leave the saving state.
    vi.mocked(useAuth).mockReturnValue({
      user: { userId: 'user-1' },
    } as unknown as ReturnType<typeof useAuth>);
    await act(async () => {
      rerender(
        <MemoryRouter initialEntries={['/save?url=https%3A%2F%2Fexample.com']}>
          <SavePage />
        </MemoryRouter>,
      );
    });

    await act(async () => {
      resolveCreate({
        id: 'link-1',
        url: 'https://example.com',
        createdAt: '',
        updatedAt: '',
        status: 'created',
      });
    });

    // No duplicate POST, and the successful save reaches the landing state
    // instead of hanging on the spinner forever.
    expect(apiModule.createLink).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Saved' }),
      ).toBeInTheDocument();
    });
  });
});

describe('SavePage when logged out', () => {
  it('stashes the url before bouncing to login and never saves', async () => {
    setLoggedOut();

    await renderLoggedOutSavePage('https://example.com/article');

    expect(setPendingSave).toHaveBeenCalledWith('https://example.com/article');
    expect(apiModule.createLink).not.toHaveBeenCalled();
  });

  it('does not stash when there is no url to save', async () => {
    setLoggedOut();

    await renderLoggedOutSavePage();

    expect(setPendingSave).not.toHaveBeenCalled();
  });
});

describe('SavePage clears the stash when it owns the save', () => {
  it('clears synchronously before the POST resolves so the drainer cannot re-fire', async () => {
    // A never-resolving save proves the clear does not wait on success; the
    // drainer reads the stash synchronously when the authed tree mounts.
    vi.mocked(apiModule.createLink).mockReturnValue(new Promise(() => {}));

    await renderSavePage('https://example.com/article');

    expect(clearPendingSave).toHaveBeenCalledTimes(1);
  });
});

describe('SavePage error state', () => {
  it('renders an alert and moves focus to the recovery link', async () => {
    vi.mocked(apiModule.createLink).mockRejectedValue(new Error('nope'));

    await renderSavePage('https://example.com/article');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    const recoveryLink = screen.getByRole('link', {
      name: 'Go to your reading list',
    });
    expect(document.activeElement).toBe(recoveryLink);
  });
});
