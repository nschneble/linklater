import { ANNOUNCE_DELAY_MS } from '../../lib/liveRegion';
import { FULL_SCREEN_CENTER } from '../../lib/styles';
import { useEffect, useRef } from 'react';
import { useReannounce } from '../../lib/hooks/useReannounce';

const ANNOUNCE_ONCE = 1;

interface LoadingScreenProps {
  focusOnMount?: boolean;
  statusText: string;
  theme?: string;
}

export default function LoadingScreen({
  focusOnMount = false,
  statusText,
  theme,
}: LoadingScreenProps) {
  const mainReference = useRef<HTMLElement>(null);
  const announcement = useReannounce(
    ANNOUNCE_ONCE,
    statusText,
    ANNOUNCE_DELAY_MS,
  );

  useEffect(() => {
    if (focusOnMount) mainReference.current?.focus();
  }, [focusOnMount]);

  return (
    <main
      ref={mainReference}
      tabIndex={focusOnMount ? -1 : undefined}
      data-theme={theme}
      className={`${FULL_SCREEN_CENTER} bg-[var(--base-bg)] text-[var(--base-alt-text)] focus:outline-none select-none`}
    >
      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </p>
      <i
        className="m-auto fa-solid fa-arrows-rotate fa-spin text-4xl"
        aria-hidden="true"
      />
    </main>
  );
}
