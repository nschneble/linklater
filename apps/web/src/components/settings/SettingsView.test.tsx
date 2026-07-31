/**
 * Tests for SettingsView, scoped to flash-message route-level state seeding.
 *
 * The `?linked=…` announcement is NOT carried by the Toast itself: the Toast
 * renders `announce={false}` (no `role`/`aria-live`), and an always-mounted
 * sr-only `role="status"` mirror region does the announcing. Mounting that
 * region unconditionally is the fix – a conditionally-mounted Toast can be
 * absent from the accessibility tree at the exact moment its message first
 * appears, so NVDA/JAWS miss it. Deferring the message past first paint is
 * still necessary (screen readers only announce an `aria-live` region when its
 * content transitions empty → populated; content present on first paint reads
 * as page load and is skipped – see `usePendingNotice.ts`), but deferral alone
 * on a conditionally-mounted Toast is not sufficient, which is the
 * misconception this suite previously encoded.
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
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Module mocks ─────────────────────────────────────────────────────────────

// useDocumentTitle is a side-effecting hook; harmless to no-op here.
vi.mock('../../lib/hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

// SettingsLayout mock keeps only children + the toast slot the test needs
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

vi.mock('./DyslexicFontToggle', () => ({
  default: () => null,
}));

vi.mock('./KeyboardShortcutsToggle', () => ({
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
  // the mirror region is mounted-but-empty at first paint, then filled by the
  // mount-effect - the empty → populated transition is observable via its
  // text. This suite only asserts provider-code → message mapping; the generic
  // ARIA contract lives in ToastAnnouncer.test.tsx.

  it('maps the linked provider code to its success message in the mirror region', async () => {
    renderAt('/settings?linked=google');

    const region = screen.getByTestId('toast-announcement');
    // empty → populated is the transition SRs need; the region stays mounted
    await waitFor(() =>
      expect(region).toHaveTextContent('Google account connected.'),
    );
  });

  it('does not focus the Toast or its dismiss button on arrival (no unsolicited focus shift)', async () => {
    renderAt('/settings?linked=google');

    const dismiss = await screen.findByRole('button', { name: 'Dismiss' });
    // user didn't initiate focus, so the Toast must not steal it on render
    expect(document.activeElement).not.toBe(dismiss);
    expect(document.activeElement).toBe(document.body);
  });

  it('falls back to a generic message when the provider code is unknown', async () => {
    renderAt('/settings?linked=plurkmail');

    const region = screen.getByTestId('toast-announcement');
    await waitFor(() => expect(region).toHaveTextContent('Account connected.'));
  });

  it('passes the linkError text down to IdPsSection inline Alert (no Toast)', async () => {
    renderAt('/settings?link_error=already_linked');

    // wait for the mount-effect to flush
    await act(async () => {});

    const error = screen.getByRole('alert');
    expect(error.textContent).toContain('That account is already linked');
    // no toast: mirror region stays empty and no Toast card mounts
    expect(screen.getByTestId('toast-announcement')).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
  });

  it('renders neither toast nor error when the URL has no flash params', async () => {
    renderAt('/settings');

    await act(async () => {});

    expect(screen.getByTestId('toast-announcement')).toBeEmptyDOMElement();
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('removes the visual Toast when the dismiss button is clicked', async () => {
    renderAt('/settings?linked=google');

    const dismiss = await screen.findByRole('button', { name: 'Dismiss' });
    fireEvent.click(dismiss);

    // Toast card unmounts after its exit animation; mirror region unaffected
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    });
  });
});
