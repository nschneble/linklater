import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import ErrorBoundary from './ErrorBoundary';
import { useState } from 'react';

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

  it('renders the custom fallback when one is provided', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary fallback={<p>scoped fallback</p>}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(screen.getByText('scoped fallback')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /reload page/i }),
    ).not.toBeInTheDocument();
  });

  it('renders nothing when fallback={null} is provided', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <ErrorBoundary fallback={null}>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(container).toBeEmptyDOMElement();
    expect(
      screen.queryByRole('button', { name: /reload page/i }),
    ).not.toBeInTheDocument();
  });

  it('clears its error state when resetKey changes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    function Harness() {
      const [step, setStep] = useState(0);
      return (
        <>
          <button onClick={() => setStep((current) => current + 1)}>
            advance
          </button>
          <ErrorBoundary fallback={<p>error fallback</p>} resetKey={step}>
            {step === 0 ? <Bomb /> : <p>recovered</p>}
          </ErrorBoundary>
        </>
      );
    }

    render(<Harness />);
    // Error caught — boundary shows fallback, not the broken child.
    expect(screen.getByText('error fallback')).toBeInTheDocument();
    expect(screen.queryByText('recovered')).not.toBeInTheDocument();

    // Change resetKey via the button — boundary clears + renders children.
    fireEvent.click(screen.getByText('advance'));
    expect(screen.getByText('recovered')).toBeInTheDocument();
    expect(screen.queryByText('error fallback')).not.toBeInTheDocument();
  });
});
