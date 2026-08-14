/**
 * The queued-notice arrival, played through the mount shape the app really
 * uses: `main.tsx` wraps the tree in `<StrictMode>`, which double-invokes
 * passive effects in development.
 *
 * The store behind a pending notice is one-shot, so the second invocation
 * of every mount effect runs against an empty store and cannot tell that
 * apart from an arrival with nothing queued. A hook rendered bare, or a
 * stubbed store that answers the same entry twice, reports green while
 * every announcement on this path has gone silent in `npm run dev` and in
 * the test-mode tree Tuffgal shoots.
 *
 * The unwrapped cases do double duty. As a control they separate the two
 * failures: both red together mean the notice path itself broke, while
 * only the wrapped one red means the effects stopped surviving the double
 * invoke. On their own they are where the declaration order of the mount
 * effects in `useAuthFormArrival.ts` is pinned, which nothing else in
 * this folder reads: the mode effect peeks the store before the consume
 * effect empties it, and that peek is all its position buys. Hoist the
 * consume effect above it and the peek finds nothing, so focus lands on
 * the email input and flips a screen reader into forms mode in the
 * middle of the message.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthForm from './AuthForm';
import {
  clearBootAnnouncementInbound,
  markBootAnnouncementInbound,
} from '../../lib/bootAnnouncementSignal';
import { MemoryRouter } from 'react-router';
import { setPendingNotice } from '../../lib/pendingNotice';

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  forgotPassword: vi.fn(),
  registerMagicLink: vi.fn(),
  requestMagicLink: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({
    login: vi.fn(),
    refreshUser: vi.fn(),
    register: vi.fn(),
  }),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BOUNCE_MESSAGE = "We couldn't get you back into that session";

async function arrive(reactStrictMode: boolean) {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthForm />
    </MemoryRouter>,
    { reactStrictMode },
  );
  await act(async () => {});
}

function mirrorText(): string | null {
  return screen.getByTestId('pending-notice-announcement').textContent;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  sessionStorage.clear();
  clearBootAnnouncementInbound();
});

afterEach(() => {
  sessionStorage.clear();
  clearBootAnnouncementInbound();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthForm – a notice queued before the form mounted', () => {
  it('announces it under the StrictMode the app mounts in', async () => {
    setPendingNotice('session-unavailable');

    await arrive(true);

    expect(mirrorText()).toBe(BOUNCE_MESSAGE);
  });

  it('paints the standing panel there too, not only the mirror', async () => {
    setPendingNotice('session-unavailable');

    await arrive(true);

    expect(
      screen.getByText(BOUNCE_MESSAGE, { selector: 'p' }),
    ).toBeInTheDocument();
  });

  it('announces it unwrapped as well (control)', async () => {
    setPendingNotice('session-unavailable');

    await arrive(false);

    expect(mirrorText()).toBe(BOUNCE_MESSAGE);
  });

  // reds on a consume-before-mode reordering, per the overview above
  it.each([false, true])(
    'holds focus off the inputs while a notice is being announced (strict mode: %s)',
    async (reactStrictMode) => {
      setPendingNotice('session-unavailable');

      await arrive(reactStrictMode);

      expect(document.activeElement).toBe(document.body);
    },
  );

  // without this the bails above pass on a form that never takes focus
  it.each([false, true])(
    'takes focus into the email input when nothing was queued (strict mode: %s)',
    async (reactStrictMode) => {
      await arrive(reactStrictMode);

      expect(document.activeElement).toBe(screen.getByLabelText(/email/i));
    },
  );

  it('leaves the region empty when nothing was queued', async () => {
    await arrive(true);

    expect(mirrorText()).toBe('');
  });

  // the panel describes the screen it arrived on, so leaving takes it
  it('still lets go of it on the way to another screen', async () => {
    setPendingNotice('session-unavailable');
    await arrive(true);
    expect(mirrorText()).toBe(BOUNCE_MESSAGE);

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Sign up' }));
    });

    expect(mirrorText()).toBe('');
  });
});

/*
 * A slow boot narrates itself out of a region above this form, and the
 * form mounts under the tail of that announcement: the flag goes up a
 * second in, and the app branch cannot appear before the threshold plus
 * the dwell floor, so the arrival is at least four tenths of a second
 * late to it. Nothing here is queued in the notice store, so the three
 * arms already on the bail all answer no.
 */
describe('AuthForm – a boot still narrating itself overhead', () => {
  it.each([false, true])(
    'holds focus off the inputs while it finishes (strict mode: %s)',
    async (reactStrictMode) => {
      markBootAnnouncementInbound();

      await arrive(reactStrictMode);

      expect(document.activeElement).toBe(document.body);
    },
  );

  // the arm has to let go, or every later mode switch is stranded too
  it('lets a later mode change take focus once the boot has spoken', async () => {
    markBootAnnouncementInbound();
    await arrive(true);
    clearBootAnnouncementInbound();

    await act(async () => {
      fireEvent.click(screen.getByRole('tab', { name: 'Sign up' }));
    });

    expect(document.activeElement).toBe(screen.getByLabelText(/email/i));
  });
});
