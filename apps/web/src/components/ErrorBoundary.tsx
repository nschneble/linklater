import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-[var(--bg)] text-[var(--text)] text-center">
          <i
            className="fa-regular fa-circle-exclamation text-4xl text-[var(--text-subtle)] mb-4"
            aria-hidden="true"
          />
          <h1 className="text-lg font-semibold mb-2">Something went wrong</h1>
          <p className="text-[var(--text-muted)] text-sm mb-6">
            An unexpected error occurred. Refreshing the page usually fixes it.
          </p>
          <button
            type="button"
            className="px-4 py-2 bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium rounded-full hover:bg-[var(--accent-hover)] transition-colors cursor-pointer"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
