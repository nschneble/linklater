/**
 * Tests for ErrorBoundary's resetKey-change recovery branch.
 *
 * The fallback *render* is already pixel-baselined by the
 * `user-crashes-app-via-failwhale` Tuffgal story, so this focuses solely on
 * the stateful `componentDidUpdate` branch: a resetKey change while
 * `hasError` is true must clear the error and re-render the children, while
 * a rerender that leaves resetKey unchanged must keep the fallback.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';
import { render, screen } from '@testing-library/react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Child({ crash }: { crash: boolean }) {
  if (crash) {
    throw new Error('boom');
  }
  return <div>recovered content</div>;
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // silence expected console.error noise from the error lifecycle hooks
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ErrorBoundary resetKey recovery', () => {
  it('clears the error and re-renders children when resetKey changes', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="a" fallback={<div>fallback shown</div>}>
        <Child crash />
      </ErrorBoundary>,
    );

    expect(screen.getByText('fallback shown')).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKey="b" fallback={<div>fallback shown</div>}>
        <Child crash={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('recovered content')).toBeInTheDocument();
    expect(screen.queryByText('fallback shown')).not.toBeInTheDocument();
  });

  it('keeps the fallback when a rerender leaves resetKey unchanged', () => {
    const { rerender } = render(
      <ErrorBoundary resetKey="a" fallback={<div>fallback shown</div>}>
        <Child crash />
      </ErrorBoundary>,
    );

    expect(screen.getByText('fallback shown')).toBeInTheDocument();

    rerender(
      <ErrorBoundary resetKey="a" fallback={<div>fallback shown</div>}>
        <Child crash={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText('fallback shown')).toBeInTheDocument();
    expect(screen.queryByText('recovered content')).not.toBeInTheDocument();
  });
});
