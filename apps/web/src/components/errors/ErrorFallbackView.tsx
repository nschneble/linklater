import PrimaryButton from '../common/PrimaryButton';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { useEffect, useRef } from 'react';

/**
 * What `ErrorBoundary` shows once a subtree has thrown.
 *
 * A component rather than markup inside the boundary, because a boundary
 * has to be a class and a class cannot hold the title effect or the focus
 * move. `NotFoundView` is the same shape one file over and for the same
 * reason: both replace the entire page with no landmark ahead of them.
 */
export default function ErrorFallbackView() {
  const mainReference = useRef<HTMLElement>(null);

  useDocumentTitle('Linklater – Something went wrong');

  // the subtree focus was in has been unmounted, so nothing holds it
  useEffect(() => {
    mainReference.current?.focus();
  }, []);

  return (
    <main
      ref={mainReference}
      tabIndex={-1}
      className="flex flex-col items-center justify-center min-h-svh px-4 bg-[var(--base-bg)] text-[var(--base-text)] text-center focus:outline-none select-none"
    >
      <i
        className="fa-solid fa-bug text-4xl text-[var(--base-subtle-text)] mb-4"
        aria-hidden="true"
      />
      <h1 className="mb-2 text-lg font-semibold">Something went wrong</h1>
      <p className="mb-6 text-[var(--base-alt-text)] text-sm">
        An unexpected error occurred. Reloading the page{' '}
        <span className="italic">usually</span> fixes it.
      </p>

      <PrimaryButton surface="base" onClick={() => window.location.reload()}>
        <i
          className="fa-solid fa-arrow-rotate-right text-xs"
          aria-hidden="true"
        />
        Reload page
      </PrimaryButton>
    </main>
  );
}
