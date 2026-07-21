import type { CreateLinkStatus } from '../../lib/api';
import { FOCUS_RING } from '../../lib/styles';
import ReadingListLink from './ReadingListLink';
import type { Ref } from 'react';

interface SaveOutcomeProps {
  // The recovery link the readable, non-urgent states focus on appearance.
  recoveryReference: Ref<HTMLAnchorElement>;
  state: 'landing' | 'error' | 'needUrl';
  status: CreateLinkStatus;
  url: string | null;
}

const MAIN_CLASS =
  'flex flex-col items-center justify-center min-h-screen max-w-md mx-auto px-4 bg-[var(--base-bg)] text-[var(--base-text)] text-center gap-4';

const LINK_CLASS = `text-[var(--base-alt-text)] hover:text-[var(--base-text)] text-sm underline underline-offset-3 ${FOCUS_RING} rounded transition duration-200`;

/**
 * The readable SavePage outcomes: the success landing (nothing to return to),
 * the save error, and the missing-url message. Each renders a single real
 * <h1> so it reads as its own page (WCAG 1.3.1 / 2.4.6); `role="alert"` rides
 * the error message only, since needUrl is informational, not urgent (4.1.3).
 */
export default function SaveOutcome({
  recoveryReference,
  state,
  status,
  url,
}: SaveOutcomeProps) {
  if (state === 'landing') {
    const outcome =
      status === 'resurfaced' ? 'Already saved. Moved to top' : 'Saved';
    return (
      <main className={MAIN_CLASS}>
        <h1 className="text-xl font-semibold text-balance">{outcome}</h1>
        {/* Announce the success politely without moving focus, so a
            screen-reader user hears the outcome instead of silence after the
            "Saving your link…" status. The no-interstitial design (WCAG 2.2.1
            / 3.2.5) means there is no focus target to land on. */}
        <p role="status" className="sr-only">
          {outcome}
        </p>
        <div className="flex items-center gap-4">
          <ReadingListLink>View reading list</ReadingListLink>
          {url && (
            <a href={url} className={LINK_CLASS}>
              Open link
            </a>
          )}
        </div>
      </main>
    );
  }

  if (state === 'error') {
    return (
      <main className={MAIN_CLASS}>
        <h1 className="text-xl font-semibold text-balance">
          We couldn't save that link.
        </h1>
        <p role="alert" className="text-[var(--base-subtle-text)] text-sm">
          The address may be private or unreachable. Try again from the page you
          wanted to save.
        </p>
        <ReadingListLink ref={recoveryReference}>
          Go to your reading list
        </ReadingListLink>
      </main>
    );
  }

  return (
    <main className={MAIN_CLASS}>
      <h1 className="text-xl font-semibold text-balance">No link to save.</h1>
      <p className="text-[var(--base-subtle-text)] text-sm">
        Open this page with a link to save, or head to your reading list.
      </p>
      <ReadingListLink ref={recoveryReference}>
        Go to your reading list
      </ReadingListLink>
    </main>
  );
}
