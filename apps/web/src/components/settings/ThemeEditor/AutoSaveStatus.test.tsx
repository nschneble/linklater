/*
 * Tests for AutoSaveStatus – the ambient save affordance + single polite
 * announcement channel. Covers the parameterized savedMessage (consume-once
 * reason), the clear-then-set re-announce for an identical message, the
 * ref-read-at-fire-time (latest message wins), the disabled hint, and the
 * fixed-color failing-contrast chip.
 */

import AutoSaveStatus from './AutoSaveStatus';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

function status() {
  return document.querySelector('[role="status"]') as HTMLElement;
}

function flushAnnounce() {
  act(() => {
    vi.advanceTimersByTime(50);
  });
}

describe('AutoSaveStatus', () => {
  it('announces nothing in the live region before the first save', () => {
    render(
      <AutoSaveStatus
        enabled
        isSaving={false}
        savedCount={0}
        savedMessage="Your theme saved."
        failingCount={0}
      />,
    );
    expect(status().textContent).toBe('');
  });

  it('announces the savedMessage when savedCount increments', () => {
    const { rerender } = render(
      <AutoSaveStatus
        enabled
        isSaving={false}
        savedCount={0}
        savedMessage="Your theme saved."
        failingCount={0}
      />,
    );
    rerender(
      <AutoSaveStatus
        enabled
        isSaving={false}
        savedCount={1}
        savedMessage="School of Rock palette applied and saved."
        failingCount={0}
      />,
    );
    flushAnnounce();
    expect(status().textContent).toBe(
      'School of Rock palette applied and saved.',
    );
  });

  it('announces the latest message even when it changes with the same tick', () => {
    // The component reads savedMessage via a ref at fire time, so a message
    // that changes in the same render as the count must not be lost to a stale
    // closure on the 50ms timer.
    const { rerender } = render(
      <AutoSaveStatus
        enabled
        isSaving={false}
        savedCount={0}
        savedMessage="Your theme saved."
        failingCount={0}
      />,
    );
    rerender(
      <AutoSaveStatus
        enabled
        isSaving={false}
        savedCount={1}
        savedMessage="Reverted to previous colors."
        failingCount={0}
      />,
    );
    flushAnnounce();
    expect(status().textContent).toBe('Reverted to previous colors.');
  });

  it('re-announces an identical message on the next save tick', () => {
    const { rerender } = render(
      <AutoSaveStatus
        enabled
        isSaving={false}
        savedCount={1}
        savedMessage="Your theme saved."
        failingCount={0}
      />,
    );
    flushAnnounce();
    expect(status().textContent).toBe('Your theme saved.');

    // Same message, next save: the clear-first step lets the live region re-fire.
    rerender(
      <AutoSaveStatus
        enabled
        isSaving={false}
        savedCount={2}
        savedMessage="Your theme saved."
        failingCount={0}
      />,
    );
    // Immediately after the bump it clears, then repopulates on the timer.
    expect(status().textContent).toBe('');
    flushAnnounce();
    expect(status().textContent).toBe('Your theme saved.');
  });

  it('keeps the live region mounted while disabled but hides the affordance', () => {
    render(
      <AutoSaveStatus
        enabled={false}
        isSaving={false}
        savedCount={0}
        savedMessage="Custom theme saved."
        failingCount={2}
      />,
    );
    // The polite region survives the custom theme being turned off so a revert
    // announcement can still fire through it.
    expect(document.querySelector('[role="status"]')).not.toBeNull();
    // ...but the visible "saved" affordance + the contrast chip are gated off.
    expect(screen.queryByText(/all changes saved/i)).toBeNull();
    expect(screen.queryByText(/contrast pairs failing/i)).toBeNull();
  });

  it('announces a message through the region even while disabled (revert path)', () => {
    const { rerender } = render(
      <AutoSaveStatus
        enabled={false}
        isSaving={false}
        savedCount={0}
        savedMessage="Custom theme saved."
        failingCount={0}
      />,
    );
    rerender(
      <AutoSaveStatus
        enabled={false}
        isSaving={false}
        savedCount={1}
        savedMessage="Your theme is off."
        failingCount={0}
      />,
    );
    flushAnnounce();
    expect(status().textContent).toBe('Your theme is off.');
  });

  it('shows the failing-contrast chip with pluralized copy, not a live region', () => {
    const { rerender } = render(
      <AutoSaveStatus
        enabled
        isSaving={false}
        savedCount={0}
        savedMessage="Your theme saved."
        failingCount={1}
      />,
    );
    expect(screen.getByText(/1 contrast pair failing/i)).toBeInTheDocument();
    rerender(
      <AutoSaveStatus
        enabled
        isSaving={false}
        savedCount={0}
        savedMessage="Your theme saved."
        failingCount={2}
      />,
    );
    expect(screen.getByText(/2 contrast pairs failing/i)).toBeInTheDocument();
    // The chip is not the polite channel; only the save region is.
    expect(status().textContent).toBe('');
  });
});
