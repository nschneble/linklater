import { Component, type ErrorInfo, type ReactNode } from 'react';
import ErrorFallbackView from './ErrorFallbackView';

interface ErrorBoundaryProps {
  /** The subtree to protect from unhandled render errors. */
  children: ReactNode;
  /**
   * Told that a child threw, so an ancestor can stop describing the app
   * as if it were still standing. Lifted rather than solved by moving the
   * boundary up: above `App`'s phase branch it would wrap the live region
   * that narrates the boot, and a catch would remount the one node the
   * whole design rests on never being remounted.
   */
  onError?: () => void;
  /**
   * Custom fallback to render when a child throws. When omitted, the default
   * full-screen "Something went wrong" UI is shown. Pass `null` to render
   * nothing – useful for scoped boundaries whose subtree is already on its
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
 * When an error is caught, it renders `ErrorFallbackView` in place of the
 * whole page. This covers the case where an unexpected exception leaves the
 * React tree in an unrecoverable state.
 *
 * NOTE: Error boundaries must be class components – hooks cannot catch render
 * errors. This is the only class component in the codebase for this reason,
 * and it is why the fallback is a component of its own: the title and the
 * focus move it owes are effects, which a class cannot hold.
 *
 * Placed at the root of the app (`App.tsx`) to catch any unhandled error
 * from the entire component tree. Also used at the route layer in
 * `AppShell.tsx` to scope errors from heavier route-level subtrees (e.g. the
 * custom API docs page and its OpenAPI parse layer) so they cannot tip the
 * whole app into the full-screen fallback during route unmount.
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
    this.props.onError?.();
  }

  componentDidUpdate(previousProps: ErrorBoundaryProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      // honor an explicit null fallback; only default when the prop is omitted
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return <ErrorFallbackView />;
    }

    return this.props.children;
  }
}
