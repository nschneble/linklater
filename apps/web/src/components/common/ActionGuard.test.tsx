/**
 * Tests for ActionGuard – the shared two-step confirmation primitive behind
 * Settings' guarded actions (Delete account, Revoke PAT, Regenerate
 * bookmarklet, unlink identity provider).
 *
 * These exercise ActionGuard's OWN contract via a minimal render-prop harness,
 * independent of any real consumer:
 *   - the confirming ⇄ trigger state machine + pending flag
 *   - Escape-to-cancel (its own document keydown listener)
 *   - focus-return-to-trigger on non-error close (synchronous, via `triggerId`)
 *   - focus-into-alert + errorFallback on a rejected `onConfirm`
 *   - the polite success announcement live region
 *   - its dev-only `confirmReference`-missing sanity warning
 *
 * Deliberately NOT retested here:
 *   - marker-based initial focus internals + the marker-missing warning →
 *     owned by `useFocusFirstButton` (`useFocusFirstButton.test.tsx`); this
 *     file only asserts ActionGuard wires `confirmReference` into it.
 *   - assembled consumer flows (reauth form, email-confirm, never-mind) →
 *     owned by `DangerZone.test.tsx`.
 */

import ActionGuard from './ActionGuard';
import { actionGuardInitialFocusProps } from '../../lib/hooks/useFocusFirstButton';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// ─── Harness ──────────────────────────────────────────────────────────────────

// Mirrors the real consumers' render-prop shape: the destructive button renders
// FIRST in DOM order, the safe (Cancel) button renders second and carries the
// focus marker. `attachReference` lets one test starve ActionGuard's dev sanity
// check by never attaching the confirm-row ref.
function ActionGuardHarness({
  onConfirm,
  errorFallback = 'Fallback message',
  successAnnouncement,
  attachReference = true,
}: {
  onConfirm: () => Promise<void>;
  errorFallback?: string;
  successAnnouncement?: string;
  attachReference?: boolean;
}) {
  return (
    <ActionGuard
      errorFallback={errorFallback}
      onConfirm={onConfirm}
      successAnnouncement={successAnnouncement}
    >
      {({
        confirming,
        pending,
        triggerId,
        confirmReference,
        openConfirm,
        closeConfirm,
        runConfirm,
      }) =>
        confirming ? (
          <div ref={attachReference ? confirmReference : null}>
            <button disabled={pending} onClick={runConfirm}>
              Yes, delete
            </button>
            <button
              {...actionGuardInitialFocusProps}
              disabled={pending}
              onClick={closeConfirm}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button id={triggerId} onClick={openConfirm}>
            Delete
          </button>
        )
      }
    </ActionGuard>
  );
}

function getTrigger() {
  return screen.getByRole('button', { name: 'Delete' });
}

function openConfirmRow() {
  fireEvent.click(getTrigger());
}

// ─── Setup ────────────────────────────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── State machine ──────────────────────────────────────────────────────────

describe('ActionGuard confirm/trigger state machine', () => {
  it('renders the trigger and not the confirm row initially', () => {
    render(<ActionGuardHarness onConfirm={vi.fn()} />);

    expect(getTrigger()).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /yes, delete/i }),
    ).not.toBeInTheDocument();
  });

  it('clicking the trigger reveals the confirm row', () => {
    render(<ActionGuardHarness onConfirm={vi.fn()} />);
    openConfirmRow();

    expect(
      screen.getByRole('button', { name: /yes, delete/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  // Proves ActionGuard passes `confirmReference` through to useFocusFirstButton,
  // which focuses the marker-attributed safe button (not the DOM-first
  // destructive one) on the next animation frame. waitFor polls past the rAF.
  it('focuses the marker-attributed safe button on open, not the destructive one', async () => {
    render(<ActionGuardHarness onConfirm={vi.fn()} />);
    openConfirmRow();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /cancel/i })).toHaveFocus();
    });
    expect(
      screen.getByRole('button', { name: /yes, delete/i }),
    ).not.toHaveFocus();
  });
});

// ─── Escape + cancel ────────────────────────────────────────────────────────

describe('ActionGuard Escape + cancel', () => {
  it('Escape closes the confirm row', () => {
    render(<ActionGuardHarness onConfirm={vi.fn()} />);
    openConfirmRow();

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(
      screen.queryByRole('button', { name: /yes, delete/i }),
    ).not.toBeInTheDocument();
    expect(getTrigger()).toBeInTheDocument();
  });

  it('Escape returns focus to the trigger', async () => {
    render(<ActionGuardHarness onConfirm={vi.fn()} />);
    openConfirmRow();

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    await waitFor(() => {
      expect(getTrigger()).toHaveFocus();
    });
  });

  it('the Cancel button closes the confirm row', () => {
    render(<ActionGuardHarness onConfirm={vi.fn()} />);
    openConfirmRow();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(
      screen.queryByRole('button', { name: /yes, delete/i }),
    ).not.toBeInTheDocument();
    expect(getTrigger()).toBeInTheDocument();
  });

  it('the Cancel button returns focus to the trigger', async () => {
    render(<ActionGuardHarness onConfirm={vi.fn()} />);
    openConfirmRow();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(getTrigger()).toHaveFocus();
    });
  });
});

// ─── Confirm ────────────────────────────────────────────────────────────────

describe('ActionGuard confirm', () => {
  it('confirming invokes onConfirm', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ActionGuardHarness onConfirm={onConfirm} />);
    openConfirmRow();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    });

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('a successful confirm closes the row and announces via the live region', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(
      <ActionGuardHarness
        onConfirm={onConfirm}
        successAnnouncement="Bookmarklet regenerated"
      />,
    );
    openConfirmRow();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    });

    expect(
      screen.queryByRole('button', { name: /yes, delete/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      /bookmarklet regenerated/i,
    );
  });

  it('disables the confirm-row buttons while onConfirm is pending', async () => {
    let resolveConfirm: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    render(<ActionGuardHarness onConfirm={onConfirm} />);
    openConfirmRow();

    fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));

    expect(screen.getByRole('button', { name: /yes, delete/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();

    await act(async () => {
      resolveConfirm();
    });
  });
});

// ─── Failure handling ─────────────────────────────────────────────────────────

describe('ActionGuard failure handling', () => {
  it('shows a rejected onConfirm message in an alert and moves focus into it', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Token is invalid'));
    render(<ActionGuardHarness onConfirm={onConfirm} />);
    openConfirmRow();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/token is invalid/i);
    expect(alert).toHaveFocus();
    // The confirm row collapses back to the trigger on failure.
    expect(
      screen.queryByRole('button', { name: /yes, delete/i }),
    ).not.toBeInTheDocument();
  });

  it('falls back to errorFallback when the rejected value is not an Error', async () => {
    const onConfirm = vi.fn().mockRejectedValue('not an error object');
    render(
      <ActionGuardHarness
        onConfirm={onConfirm}
        errorFallback="Could not complete the action"
      />,
    );
    openConfirmRow();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    });

    expect(screen.getByRole('alert')).toHaveTextContent(
      /could not complete the action/i,
    );
  });

  it('reopening the confirm row clears a previous error', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Token is invalid'));
    render(<ActionGuardHarness onConfirm={onConfirm} />);
    openConfirmRow();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    });

    expect(screen.getByRole('alert')).toBeInTheDocument();

    openConfirmRow();

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// ─── Dev sanity check ─────────────────────────────────────────────────────────

describe('ActionGuard dev sanity check', () => {
  // ActionGuard's OWN warning (distinct from useFocusFirstButton's
  // marker-missing warning): fires when `confirming` flips true but the caller
  // never attached `confirmReference`, so focus management silently no-ops.
  it('warns in dev when confirmReference is not attached to the confirm row', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<ActionGuardHarness onConfirm={vi.fn()} attachReference={false} />);
    openConfirmRow();

    await waitFor(() => {
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining('[ActionGuard]'),
      );
    });
  });
});
