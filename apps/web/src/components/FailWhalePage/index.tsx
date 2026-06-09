import PrimaryButton from '../common/PrimaryButton';
import { useEffect, useState } from 'react';

const FAILWHALE_ASCII = String.raw`
              v  ~
        v
                  |
   v        ___///___       v
 .-~~~~~-.  \      /  .-~~~~~-.
 |  ___  |   \____/   |  ___  |
 |_|   |_|_____||_____|_|   |_|
            \  ||  /
             \_||_/
              '--'
`;

/**
 * Public Easter-egg page at /failwhale.
 *
 * Lets curious visitors (and the testing-ui harness) intentionally trigger the
 * app-root ErrorBoundary. The button activates a child that throws in render;
 * the boundary catches it and swaps the page for the standard "Something went
 * wrong" fallback. Reloading recovers.
 */
export default function FailWhalePage() {
  const [shouldCrash, setShouldCrash] = useState(false);

  // Mount a robots=noindex meta tag so search engines do not surface
  // this destructive easter egg. App has no SSR head manager
  // (react-helmet, etc.), so inject directly and clean up on unmount.
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex';
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-[var(--bg-surface)] focus:text-[var(--text)] focus:text-sm focus:font-semibold focus:rounded-lg focus:ring-2 focus:ring-[var(--focus-ring)] focus:outline-none"
      >
        Skip to main content
      </a>
      <main
        id="main-content"
        className="flex flex-col items-center justify-center min-h-screen mx-auto max-w-md px-4 text-center"
      >
        <pre
          aria-hidden="true"
          className="mb-6 text-[var(--text-muted)] text-xs leading-snug select-none"
        >
          {FAILWHALE_ASCII}
        </pre>
        <h1 className="mb-3 text-[var(--text)] text-2xl font-bold text-balance">
          You found the failwhale!
        </h1>
        <p className="mb-6 text-[var(--text-muted)] text-sm text-balance">
          This is a dead end on purpose. Press the button below and Linklater
          will throw a render error so you can see the app's error screen
          firsthand.
        </p>
        <PrimaryButton
          type="button"
          aria-describedby="crash-help"
          onClick={() => setShouldCrash(true)}
        >
          Crash this page on purpose
        </PrimaryButton>
        <p
          id="crash-help"
          className="mt-4 text-[var(--text-subtle)] text-xs text-balance"
        >
          Triggers the app's error screen. Reload the page to recover.
        </p>
        <Crasher shouldCrash={shouldCrash} />
      </main>
    </div>
  );
}

interface CrasherProps {
  shouldCrash: boolean;
}

/**
 * Tiny child whose render throws when `shouldCrash` is true. Isolated so the
 * parent's interactive surface (skip link, heading, button, help text) is
 * fully composed and screenshot-able before the crash is triggered.
 */
function Crasher({ shouldCrash }: CrasherProps) {
  if (shouldCrash) {
    throw new Error(
      'You crashed Linklater on purpose. The failwhale is proud of you.',
    );
  }
  return null;
}
