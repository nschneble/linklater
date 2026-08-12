/**
 * Tests for PendingNoticeAnnouncer.
 *
 * The primitive pairs a conditional `<Toast>` with a pre-mounted sr-only
 * mirror. The mirror's role/aria-live MUST match the toast's variant per
 * a11y-lead - a polite mirror under an assertive toast lets the two regions
 * race on the SR's announcement queue with mismatched priorities.
 *
 * Coverage:
 *   - Mirror is always mounted (empty or populated)
 *   - variant='success' renders the mirror as role="status" aria-live="polite"
 *   - variant='error' renders the mirror as role="alert" aria-live="assertive"
 *   - The Toast is omitted when notice is null
 *   - The Toast paints with the right variant when notice is non-null
 *   - The mirror is the ONLY live region; the toast announces nothing
 *   - `standing` swaps the toast for an in-flow panel that never times out
 */

import { describe, expect, it, vi } from 'vitest';
import PendingNoticeAnnouncer from './PendingNoticeAnnouncer';
import { render, screen } from '@testing-library/react';

describe('PendingNoticeAnnouncer mirror – success variant', () => {
  it('renders the sr-only mirror with role="status" and aria-live="polite" when variant is success', () => {
    render(
      <PendingNoticeAnnouncer
        notice="Your email has been verified."
        variant="success"
        onDismiss={vi.fn()}
      />,
    );

    const mirror = document.querySelector(
      'span.sr-only[role="status"][aria-live="polite"][aria-atomic="true"]',
    );
    expect(mirror).toBeInTheDocument();
    expect(mirror?.textContent).toBe('Your email has been verified.');
  });

  it('renders the visible Toast with the success variant (fa-circle-check icon)', () => {
    const { container } = render(
      <PendingNoticeAnnouncer
        notice="Your email has been verified."
        variant="success"
        onDismiss={vi.fn()}
      />,
    );

    // success icon is fa-circle-check (error uses fa-circle-exclamation)
    expect(container.querySelector('.fa-circle-check')).toBeInTheDocument();
    expect(
      container.querySelector('.fa-circle-exclamation'),
    ).not.toBeInTheDocument();
  });
});

describe('PendingNoticeAnnouncer mirror – error variant', () => {
  it('renders the sr-only mirror with role="alert" and aria-live="assertive" when variant is error', () => {
    render(
      <PendingNoticeAnnouncer
        notice="Verification link expired."
        variant="error"
        onDismiss={vi.fn()}
      />,
    );

    const mirror = document.querySelector(
      'span.sr-only[role="alert"][aria-live="assertive"][aria-atomic="true"]',
    );
    expect(mirror).toBeInTheDocument();
    expect(mirror?.textContent).toBe('Verification link expired.');
  });

  it('renders the visible Toast with the error variant (fa-circle-exclamation icon)', () => {
    const { container } = render(
      <PendingNoticeAnnouncer
        notice="Verification link expired."
        variant="error"
        onDismiss={vi.fn()}
      />,
    );

    expect(
      container.querySelector('.fa-circle-exclamation'),
    ).toBeInTheDocument();
    expect(container.querySelector('.fa-circle-check')).not.toBeInTheDocument();
  });
});

describe('PendingNoticeAnnouncer announcement channels', () => {
  it.each([['success' as const], ['warning' as const], ['error' as const]])(
    'puts exactly one live region on the message for the %s variant',
    (variant) => {
      const { container } = render(
        <PendingNoticeAnnouncer
          notice="Your email has been verified."
          variant={variant}
          onDismiss={vi.fn()}
        />,
      );

      // two regions on one message is one message read twice
      expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
    },
  );

  it('leaves the visible toast card with no ARIA live semantics of its own', () => {
    const { container } = render(
      <PendingNoticeAnnouncer
        notice="Your email has been verified."
        variant="warning"
        onDismiss={vi.fn()}
      />,
    );

    const card = container
      .querySelector('.fa-triangle-exclamation')
      ?.closest('div');
    expect(card).not.toBeNull();
    expect(card).not.toHaveAttribute('role');
    expect(card).not.toHaveAttribute('aria-live');
  });

  it('keeps the sr-only mirror as the one that carries the text', () => {
    const { container } = render(
      <PendingNoticeAnnouncer
        notice="Your email has been verified."
        variant="warning"
        onDismiss={vi.fn()}
      />,
    );

    const region = container.querySelector('[aria-live]');
    expect(region).toHaveClass('sr-only');
    expect(region?.textContent).toBe('Your email has been verified.');
  });
});

describe('PendingNoticeAnnouncer null notice', () => {
  it('omits the visible Toast when notice is null', () => {
    render(
      <PendingNoticeAnnouncer
        notice={null}
        variant="success"
        onDismiss={vi.fn()}
      />,
    );

    // no icon = no toast (only the Toast emits icons here)
    expect(document.querySelector('.fa-circle-check')).not.toBeInTheDocument();
    expect(
      document.querySelector('.fa-circle-exclamation'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull();
  });

  it('keeps the sr-only mirror mounted (with empty text) when notice is null', () => {
    render(
      <PendingNoticeAnnouncer
        notice={null}
        variant="success"
        onDismiss={vi.fn()}
      />,
    );

    const mirror = document.querySelector(
      'span.sr-only[aria-live][aria-atomic="true"]',
    );
    expect(mirror).toBeInTheDocument();
    expect(mirror?.textContent).toBe('');
  });

  it('mirror still tracks the error variant ARIA shape even when notice is null', () => {
    render(
      <PendingNoticeAnnouncer
        notice={null}
        variant="error"
        onDismiss={vi.fn()}
      />,
    );

    // pre-mount the ARIA shape so a later notice fires at the right politeness
    const mirror = document.querySelector(
      'span.sr-only[role="alert"][aria-live="assertive"][aria-atomic="true"]',
    );
    expect(mirror).toBeInTheDocument();
    expect(mirror?.textContent).toBe('');
  });
});

describe('PendingNoticeAnnouncer standing notice', () => {
  const REASON = "We couldn't get you back into that session";

  function renderStanding(standing: boolean) {
    return render(
      <PendingNoticeAnnouncer
        notice={REASON}
        variant="warning"
        onDismiss={vi.fn()}
        standing={standing}
      />,
    );
  }

  it('paints in the flow rather than fixed to the viewport bottom', () => {
    const { container } = renderStanding(true);

    const panel = container.querySelector('.fa-circle-info')?.closest('div');
    expect(panel).not.toBeNull();
    expect(panel?.className).not.toContain('fixed');
    expect(panel?.className).not.toContain('z-50');
  });

  it('offers no dismiss control, since nothing takes the message away', () => {
    renderStanding(true);

    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull();
  });

  it('stays on screen past every timer the toast would have run', () => {
    vi.useFakeTimers();
    try {
      renderStanding(true);

      vi.advanceTimersByTime(60_000);

      expect(screen.getAllByText(REASON).length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the sr-only mirror as the only live region', () => {
    const { container } = renderStanding(true);

    expect(container.querySelectorAll('[aria-live]')).toHaveLength(1);
    const painted = screen
      .getAllByText(REASON)
      .find((element) => element.closest('.sr-only') === null);
    expect(painted).toHaveAttribute('aria-hidden', 'true');
  });

  it('rides the toast when the notice is not standing', () => {
    const { container } = renderStanding(false);

    expect(container.querySelector('.fa-circle-info')).toBeNull();
    expect(
      container.querySelector('.fa-triangle-exclamation')?.closest('div')
        ?.className,
    ).toContain('fixed');
  });

  it('rides the toast when nothing says either way', () => {
    const { container } = render(
      <PendingNoticeAnnouncer
        notice={REASON}
        variant="warning"
        onDismiss={vi.fn()}
      />,
    );

    expect(container.querySelector('.fa-circle-info')).toBeNull();
    expect(container.querySelector('.fa-triangle-exclamation')).not.toBeNull();
  });

  it('paints nothing at all when there is no notice to stand', () => {
    const { container } = render(
      <PendingNoticeAnnouncer
        notice={null}
        variant="warning"
        onDismiss={vi.fn()}
        standing
      />,
    );

    expect(container.querySelector('.fa-circle-info')).toBeNull();
    expect(container.querySelector('[aria-live]')?.textContent).toBe('');
  });
});
