import { Component, type ErrorInfo, type ReactNode } from 'react';
import PrimaryButton from '../common/PrimaryButton';

interface ErrorBoundaryProps {
  /** The subtree to protect from unhandled render errors. */
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Class-based error boundary that catches unhandled errors thrown during
 * rendering, in lifecycle methods, or in constructors of any child component.
 *
 * When an error is caught, it renders a full-screen fallback with a "Retry"
 * button that reloads the page. This covers the case where an unexpected
 * exception leaves the React tree in an unrecoverable state.
 *
 * NOTE: Error boundaries must be class components — hooks cannot catch render
 * errors. This is the only class component in the codebase for this reason.
 *
 * Placed at the root of the app (`App.tsx`) to catch any unhandled error
 * from the entire component tree.
 */
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
            className="fa-regular fa-bug text-4xl text-[var(--text-subtle)] mb-4"
            aria-hidden="true"
          />
          <h1 className="mb-2 text-lg font-semibold">Something went wrong</h1>
          <p className="mb-6 text-[var(--text-muted)] text-sm">
            An unexpected error occurred. Reloading the page{' '}
            <span className="italic">usually</span> fixes it.
          </p>

          <PrimaryButton onClick={() => window.location.reload()}>
            <i
              className="fa-solid fa-arrow-rotate-right text-xs"
              aria-hidden="true"
            />
            Reload page
          </PrimaryButton>
        </div>
      );
    }

    return this.props.children;
  }
}
