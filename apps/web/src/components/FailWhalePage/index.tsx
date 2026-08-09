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

  // inject a robots=noindex meta so the crash easter egg isn't indexed
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
    <div className="min-h-screen bg-[var(--base-bg)] text-[var(--base-text)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-[var(--mount-bg)] focus:text-[var(--mount-text)] focus:text-sm focus:font-semibold focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:rounded-lg"
      >
        Skip to main content
      </a>
      <main
        id="main-content"
        className="flex flex-col items-center justify-center max-w-md min-h-svh mx-auto px-4 text-center"
      >
        <pre
          aria-hidden="true"
          className="mb-6 text-[var(--base-alt-text)] text-xs leading-snug select-none"
        >
          {FAILWHALE_ASCII}
        </pre>
        <h1 className="mb-3 text-[var(--base-text)] text-2xl font-bold text-balance">
          You found the failwhale!
        </h1>
        <p className="mb-6 text-[var(--base-alt-text)] text-sm text-balance">
          This is a dead end on purpose. Press the button below and Linklater
          will throw a render error so you can see the app's error screen
          firsthand.
        </p>
        <PrimaryButton
          type="button"
          surface="base"
          aria-describedby="crash-help"
          onClick={() => setShouldCrash(true)}
        >
          Crash this page on purpose
        </PrimaryButton>
        <p
          id="crash-help"
          className="mt-4 text-[var(--base-subtle-text)] text-xs text-balance"
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
