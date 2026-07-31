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
 */

import PendingNoticeAnnouncer from './PendingNoticeAnnouncer';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
