/**
 * Canonical contract test for ToastAnnouncer – the primitive that pairs a
 * conditionally-mounted visual <Toast> with an always-mounted sr-only live
 * mirror. This is where the `announce={false}` card + mirror-region ARIA
 * contract is proven ONCE; consumer suites (SettingsView, BookmarkletSection,
 * LinksView) assert only their own message-mapping/wiring on top of it.
 *
 * Why the split exists: the visual Toast is mounted only while `message` is
 * non-null, so NVDA/JAWS can miss its first announcement (the live node isn't
 * in the accessibility tree at the instant the region would fire). Toast is
 * therefore rendered with `announce={false}` (no `role`/`aria-live`) and the
 * announcement is routed through the always-mounted `role="status"` mirror,
 * which stays in the DOM even when no toast is showing so the next message's
 * empty → populated transition still fires.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ToastAnnouncer from './ToastAnnouncer';

describe('ToastAnnouncer', () => {
  it('renders the visual Toast with announce={false} (no role/aria-live on the card)', () => {
    render(
      <ToastAnnouncer
        message="Link saved!"
        onDismiss={() => {}}
        testId="toast-announcement"
      />,
    );

    // Locate the visual card via its dismiss button: the always-mounted mirror
    // is itself role="status", so queryByRole('status') can't isolate the card.
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    const card = dismiss.closest('div');
    expect(card).toHaveTextContent('Link saved!');
    expect(card).not.toHaveAttribute('role');
    expect(card).not.toHaveAttribute('aria-live');
    // The card owns no assertive live-region semantics either.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('mirrors the message into an always-mounted polite status region', async () => {
    render(
      <ToastAnnouncer
        message="Link saved!"
        onDismiss={() => {}}
        testId="toast-announcement"
      />,
    );

    const region = screen.getByTestId('toast-announcement');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');

    // The mirror clears-then-sets, deferring even the first announcement one
    // tick, so the empty → populated transition SRs need is observable after a
    // flush rather than on first paint.
    await waitFor(() => expect(region).toHaveTextContent('Link saved!'));
  });

  it('omits the visual Toast but keeps an empty mirror when message is null', () => {
    render(
      <ToastAnnouncer
        message={null}
        onDismiss={() => {}}
        testId="toast-announcement"
      />,
    );

    // No visual card (its dismiss button is the tell) …
    expect(screen.queryByRole('button', { name: 'Dismiss' })).toBeNull();
    // … but the live region stays mounted and empty so a later message still
    // produces an empty → populated transition.
    const region = screen.getByTestId('toast-announcement');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toBeEmptyDOMElement();
  });

  it('gives each host its own mirror channel via the testId prop', () => {
    render(
      <ToastAnnouncer
        message={null}
        onDismiss={() => {}}
        testId="bookmarklet-toast-announcement"
      />,
    );

    expect(
      screen.getByTestId('bookmarklet-toast-announcement'),
    ).toBeInTheDocument();
  });

  it('fires onDismiss when the visual Toast is dismissed', async () => {
    const handleDismiss = vi.fn();
    render(
      <ToastAnnouncer
        message="Link saved!"
        onDismiss={handleDismiss}
        testId="toast-announcement"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    // Toast runs a 150ms exit animation before invoking onDismiss.
    await waitFor(() => expect(handleDismiss).toHaveBeenCalledTimes(1));
  });
});
