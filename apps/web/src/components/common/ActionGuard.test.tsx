import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ActionGuard from './ActionGuard';
import type { ActionGuardRenderHelpers } from './ActionGuard';

interface HarnessProps {
  errorFallback?: string;
  onConfirm?: () => Promise<void>;
  successAnnouncement?: string;
}

/**
 * Minimal caller wired up the same way the three real call sites are. Keeps
 * the tests focused on ActionGuard's behavior, not the cosmetics of any one
 * caller.
 */
function Harness({
  errorFallback = 'Failed',
  onConfirm = () => Promise.resolve(),
  successAnnouncement,
}: HarnessProps) {
  return (
    <ActionGuard
      onConfirm={onConfirm}
      errorFallback={errorFallback}
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
      }: ActionGuardRenderHelpers) =>
        !confirming ? (
          <button id={triggerId} type="button" onClick={openConfirm}>
            Open
          </button>
        ) : (
          <div ref={confirmReference}>
            <button type="button" disabled={pending} onClick={runConfirm}>
              {pending ? 'Working…' : 'Yes'}
            </button>
            <button type="button" disabled={pending} onClick={closeConfirm}>
              No
            </button>
          </div>
        )
      }
    </ActionGuard>
  );
}

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ActionGuard', () => {
  it('renders the trigger initially and swaps to the confirm row on open', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: 'Open' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Yes' }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('button', { name: 'Yes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Open' }),
    ).not.toBeInTheDocument();
  });

  it('focuses the first confirm button when the confirm row opens', async () => {
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Yes' }),
      );
    });
  });

  it('returns focus to the trigger when Cancel is clicked', async () => {
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'No' }));
    });

    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Open' }),
      );
    });
  });

  it('cancels and returns focus to the trigger when Escape is pressed', async () => {
    render(<Harness />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    });
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape' });
    });

    expect(
      screen.queryByRole('button', { name: 'Yes' }),
    ).not.toBeInTheDocument();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Open' }),
      );
    });
  });

  it('runs onConfirm, closes the row, and returns focus to the trigger on success', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<Harness onConfirm={onConfirm} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    });

    expect(onConfirm).toHaveBeenCalledOnce();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Open' }),
      );
    });
  });

  it('exposes pending=true while onConfirm is in flight (flips Yes label)', async () => {
    let resolveAction: () => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveAction = resolve;
        }),
    );
    render(<Harness onConfirm={onConfirm} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    });

    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();

    await act(async () => {
      resolveAction();
    });
  });

  it('focuses the error alert on failure (winning over return-focus to trigger)', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('Boom'));
    render(<Harness onConfirm={onConfirm} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Boom');
    // Critical: focus lands in the alert, NOT on the trigger. This is the
    // race that effect ordering must not break.
    await waitFor(() => {
      expect(document.activeElement).toBe(alert);
    });
  });

  it('falls back to errorFallback when the caught error has no message', async () => {
    const onConfirm = vi.fn().mockRejectedValue('not-an-error');
    render(<Harness onConfirm={onConfirm} errorFallback="Default message" />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Default message',
    );
  });

  it('clears a previous error when the confirm row is reopened', async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error('Boom'));
    render(<Harness onConfirm={onConfirm} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    });

    await screen.findByRole('alert');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces successAnnouncement via a polite live region', async () => {
    render(
      <Harness
        onConfirm={() => Promise.resolve()}
        successAnnouncement="Done!"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    });

    await waitFor(() => {
      const statuses = screen.getAllByRole('status');
      const announcement = statuses.find((node) =>
        /done!/i.test(node.textContent ?? ''),
      );
      expect(announcement).toBeTruthy();
    });
  });

  it('keeps the live-region node mounted even when announcement is empty', () => {
    render(<Harness successAnnouncement="ignored" />);
    // The polite region exists at render time so later mutations are not
    // missed by older AT setups that don't observe mount→insert.
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('gives each instance a unique triggerId so multi-row pages do not collide', () => {
    render(
      <div>
        <Harness />
        <Harness />
      </div>,
    );
    const triggers = screen.getAllByRole('button', { name: 'Open' });
    expect(triggers).toHaveLength(2);
    expect(triggers[0].id).not.toBe('');
    expect(triggers[1].id).not.toBe('');
    expect(triggers[0].id).not.toBe(triggers[1].id);
  });
});
