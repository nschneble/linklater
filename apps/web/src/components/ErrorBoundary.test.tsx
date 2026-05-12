import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

afterEach(() => vi.restoreAllMocks());

function Bomb() {
  throw new Error('test explosion');
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>working fine</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('working fine')).toBeInTheDocument();
  });

  it('renders fallback UI when a child throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('heading')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /reload page/i }),
    ).toBeInTheDocument();
  });

  it('does not show the broken child when an error occurs', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.queryByText('working fine')).not.toBeInTheDocument();
  });
});
