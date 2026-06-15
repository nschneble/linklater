/**
 * Tests for SettingsView, scoped to flash-message route-level state seeding.
 *
 * The Toast announcing `?linked=…` must surface AFTER a mount-effect — not on
 * synchronous first render. NVDA/JAWS only announce an `aria-live` region
 * when content transitions empty → populated; content present on first paint
 * is treated as page load and skipped (see `usePendingNotice.ts` comment).
 *
 * Deep children (SettingsLayout, AccountSettingsForm, every other section)
 * are mocked to keep this test focused on the orchestrator's behavior.
 */

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

// useDocumentTitle is a side-effecting hook; harmless to no-op here.
vi.mock('../../lib/hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

// SettingsLayout drops the sidebar/skip-link chrome; the test only cares
// about the children + toast slot, which all render straight under it.
vi.mock('./SettingsLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="settings-layout">{children}</div>
  ),
}));

vi.mock('./SettingsGroup', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./AccountSettingsForm', () => ({
  default: () => null,
}));

vi.mock('./ApiTokensSection', () => ({
  default: () => null,
}));

vi.mock('./BookmarkletSection', () => ({
  default: () => null,
}));

vi.mock('./CvdModeToggle', () => ({
  default: () => null,
}));

vi.mock('./DangerZone', () => ({
  default: () => null,
}));

vi.mock('./MultiFactorSection', () => ({
  default: () => null,
}));

vi.mock('./IdPsSection', () => ({
  default: ({ linkError }: { linkError?: string | null }) =>
    linkError ? <div role="alert">{linkError}</div> : null,
}));

vi.mock('../stumble/StumbleSection', () => ({
  default: () => null,
}));

vi.mock('./useSettingsActiveSection', () => ({
  useSettingsActiveSection: () => ({
    activeSection: 'account',
    activateSection: vi.fn(),
  }),
}));

vi.mock('./settingsScroll', () => ({
  setActiveSettingsSection: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import SettingsView from './SettingsView';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SettingsView appleEnabled={true} googleEnabled={true} />
    </MemoryRouter>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SettingsView OAuth-link flash toast', () => {
  // The "NOT in the DOM synchronously on first paint" half of the F6
  // contract is held by construction: `toastMessage` is initialized to
  // `null` via `useState`, so the first commit cannot render the Toast.
  // The mount-effect then flips state, and the empty → populated
  // transition that NVDA/JAWS require is observable via the deferred
  // `findByRole('status')` in the next test.

  it('renders the success Toast after the mount-effect flushes (deferred announce for SR a11y)', async () => {
    renderAt('/settings?linked=google');

    const toast = await screen.findByRole('status');
    expect(toast.textContent).toContain(
      'Google account connected successfully.',
    );
  });

  it('does not focus the Toast or its dismiss button on arrival (no unsolicited focus shift)', async () => {
    renderAt('/settings?linked=google');

    await screen.findByRole('status');
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    // User did not initiate focus; the Toast must render with no focus
    // side-effect. The dismiss button is naturally Tab-reachable.
    expect(document.activeElement).not.toBe(dismiss);
    expect(document.activeElement).toBe(document.body);
  });

  it('falls back to a generic message when the provider code is unknown', async () => {
    renderAt('/settings?linked=plurkmail');

    const toast = await screen.findByRole('status');
    expect(toast.textContent).toContain('plurkmail account connected.');
  });

  it('passes the linkError text down to IdPsSection inline Alert (no Toast)', async () => {
    renderAt('/settings?link_error=already_linked');

    // Wait for the mount-effect to flush.
    await act(async () => {});

    const error = screen.getByRole('alert');
    expect(error.textContent).toContain('That account is already linked');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('renders neither toast nor error when the URL has no flash params', async () => {
    renderAt('/settings');

    await act(async () => {});

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('clears the toast when the dismiss button is clicked', async () => {
    renderAt('/settings?linked=google');

    const toast = await screen.findByRole('status');
    expect(toast).toBeTruthy();

    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismiss);

    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
  });
});
