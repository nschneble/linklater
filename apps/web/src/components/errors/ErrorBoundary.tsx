import { Component, type ErrorInfo, type ReactNode } from 'react';
import PrimaryButton from '../common/PrimaryButton';

interface ErrorBoundaryProps {
  /** The subtree to protect from unhandled render errors. */
  children: ReactNode;
  /**
   * Custom fallback to render when a child throws. When omitted, the default
   * full-screen "Something went wrong" UI is shown. Pass `null` to render
   * nothing — useful for scoped boundaries whose subtree is already on its
   * way out (e.g. wrapping a third-party widget that throws during unmount
   * while the user navigates away).
   */
  fallback?: ReactNode;
  /**
   * When this value changes between renders, the boundary clears its error
   * state and re-renders `children`. Without this, a boundary at a stable
   * JSX position (so its fiber survives across the subtree it protects)
   * would stay stuck in the error state forever after catching a single
   * teardown throw. Typical usage: `resetKey={view}` so each new route key
   * gives the protected subtree a fresh attempt.
   */
  resetKey?: unknown;
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
 * from the entire component tree. Also used at the route layer in
 * `AppShell.tsx` to scope errors from heavy third-party embeds (e.g. the
 * Scalar API reference) so they cannot tip the whole app into the
 * full-screen fallback during route unmount.
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

  componentDidUpdate(previousProps: ErrorBoundaryProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      // Honor an explicit `null` fallback — only fall through to the default
      // UI when the prop is genuinely omitted.
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return (
        <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-[var(--base-bg)] text-[var(--base-text)] text-center select-none">
          <i
            className="fa-solid fa-bug text-4xl text-[var(--base-subtle-text)] mb-4"
            aria-hidden="true"
          />
          <h1 className="mb-2 text-lg font-semibold">Something went wrong</h1>
          <p className="mb-6 text-[var(--base-alt-text)] text-sm">
            An unexpected error occurred. Reloading the page{' '}
            <span className="italic">usually</span> fixes it.
          </p>

          <PrimaryButton
            surface="base"
            onClick={() => window.location.reload()}
          >
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
