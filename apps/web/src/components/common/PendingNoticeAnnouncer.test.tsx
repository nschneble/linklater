/*
 * Tests for PendingNoticeAnnouncer.
 *
 * The primitive is now a thin wrapper over `<Toast>`: the Toast owns the
 * announcement via its own sr-only live region, so there is exactly ONE
 * live region here. The old external mirror (a second live region) is gone,
 * and these tests guard against it coming back and double-announcing.
 *
 * Coverage:
 *   - Exactly one live region, with the right role/politeness per variant
 *   - variant='success' announces politely (role="status")
 *   - variant='error' announces assertively (role="alert")
 *   - The visible Toast paints the right icon for the variant
 *   - Nothing renders when notice is null
 */

import PendingNoticeAnnouncer from './PendingNoticeAnnouncer';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

describe('PendingNoticeAnnouncer – success variant', () => {
  it('announces through exactly one polite live region (no double-announce)', () => {
    render(
      <PendingNoticeAnnouncer
        notice="Your email has been verified."
        variant="success"
        onDismiss={vi.fn()}
      />,
    );

    const liveRegions = document.querySelectorAll('[aria-live]');
    expect(liveRegions).toHaveLength(1);
    expect(liveRegions[0].getAttribute('role')).toBe('status');
    expect(liveRegions[0].getAttribute('aria-live')).toBe('polite');
    expect(liveRegions[0].getAttribute('aria-atomic')).toBe('true');
  });

  it('renders the visible message synchronously with the success icon (fa-circle-check)', () => {
    const { container } = render(
      <PendingNoticeAnnouncer
        notice="Your email has been verified."
        variant="success"
        onDismiss={vi.fn()}
      />,
    );

    // Visible text is present at first paint (no deferred fill on the visible
    // toast) and targeted by the `div` selector so the sr-only span is excluded.
    expect(
      screen.getByText('Your email has been verified.', { selector: 'div' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.fa-circle-check')).toBeInTheDocument();
    expect(
      container.querySelector('.fa-circle-exclamation'),
    ).not.toBeInTheDocument();
  });
});

describe('PendingNoticeAnnouncer – error variant', () => {
  it('announces through exactly one assertive live region (no double-announce)', () => {
    render(
      <PendingNoticeAnnouncer
        notice="Verification link expired."
        variant="error"
        onDismiss={vi.fn()}
      />,
    );

    const liveRegions = document.querySelectorAll('[aria-live]');
    expect(liveRegions).toHaveLength(1);
    expect(liveRegions[0].getAttribute('role')).toBe('alert');
    expect(liveRegions[0].getAttribute('aria-live')).toBe('assertive');
    expect(liveRegions[0].getAttribute('aria-atomic')).toBe('true');
  });

  it('renders the visible Toast with the error icon (fa-circle-exclamation)', () => {
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

describe('PendingNoticeAnnouncer – null notice', () => {
  it('renders nothing when notice is null', () => {
    const { container } = render(
      <PendingNoticeAnnouncer
        notice={null}
        variant="success"
        onDismiss={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
    expect(document.querySelector('[aria-live]')).toBeNull();
    expect(document.querySelector('.fa-circle-check')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dismiss/i })).toBeNull();
  });
});
