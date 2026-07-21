import { useAuth } from '../../auth/AuthContext';
import { createLink } from '../../lib/api';
import type { CreateLinkStatus } from '../../lib/api';
import { useDocumentTitle } from '../../lib/hooks/useDocumentTitle';
import { clearPendingSave, setPendingSave } from '../../lib/pendingSave';
import LoadingIndicator from '../common/LoadingIndicator';
import SaveOutcome from './SaveOutcome';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';

type SaveState = 'saving' | 'landing' | 'error' | 'needUrl';

const TITLES: Record<SaveState, string> = {
  saving: 'Linklater – Saving…',
  landing: 'Linklater – Saved',
  error: 'Linklater – Save error',
  needUrl: 'Linklater – Nothing to save',
};

/**
 * Public `/save?url=` route. On mount it saves the link and, on success,
 * returns the user to wherever they came from with the least UI possible:
 * closes a script-opened tab, or steps back in history, and only shows a
 * landing state when there is nowhere to return to. The auto-return is a
 * Change on Request (the user asked to save), so it must never be turned into
 * a confirmation interstitial (WCAG 2.2.1 / 3.2.5).
 */
export default function SavePage() {
  const { user } = useAuth();
  const location = useLocation();
  const [searchParameters] = useSearchParams();
  const url = searchParameters.get('url');

  const [state, setState] = useState<SaveState>(url ? 'saving' : 'needUrl');
  const [savedStatus, setSavedStatus] = useState<CreateLinkStatus>('created');
  const recoveryReference = useRef<HTMLAnchorElement>(null);
  // Guards against a duplicate POST if auth state re-emits (e.g. the
  // visibility-refresh in useAuthState swaps the user object) while the save
  // is still in flight.
  const hasAttemptedReference = useRef(false);
  // Gates the result commit on a genuine unmount, not on the per-run effect
  // cleanup. When auth re-emits a new user object mid-save the effect re-runs,
  // its cleanup fires, and the single-POST guard blocks a fresh attempt; a
  // per-run flag would leave the original in-flight POST unable to commit its
  // result, stranding the user on the spinner even though the save succeeded.
  const isMountedReference = useRef(true);

  useDocumentTitle(TITLES[state]);

  useEffect(() => {
    isMountedReference.current = true;
    return () => {
      isMountedReference.current = false;
    };
  }, []);

  useEffect(() => {
    if (!user || !url || hasAttemptedReference.current) return;
    hasAttemptedReference.current = true;
    // This path owns saving `url` (the password-resume flow returns here via
    // `?url=`), so drop the stash up front. Clearing before the POST, not in
    // its `.then`, keeps the drainer, which reads the stash synchronously when
    // the authed tree mounts, from racing ahead and saving the same url twice.
    clearPendingSave();
    createLink({ url })
      .then((link) => {
        if (!isMountedReference.current) return;
        const status = link.status ?? 'created';
        // A script-opened tab (browser extension / retired bookmarklet) can be
        // closed, dropping the user straight back on their source tab with
        // scroll intact.
        if (window.opener) {
          window.close();
          // The browser may refuse to close a tab it did not script-open, so
          // fall through to the landing state rather than strand the user.
          setSavedStatus(status);
          setState('landing');
          return;
        }
        // A prior history entry means we can hand them back to it; the browser
        // restores their scroll position natively.
        if (window.history.length > 1) {
          window.history.back();
          return;
        }
        setSavedStatus(status);
        setState('landing');
      })
      .catch(() => {
        if (isMountedReference.current) setState('error');
      });
  }, [user, url]);

  // Move focus onto the single recovery link when a readable, non-urgent
  // outcome appears so keyboard and screen-reader users land on the way out
  // (WCAG 2.4.3). Landing is a success state and keeps focus where it is.
  useEffect(() => {
    if (state === 'error' || state === 'needUrl') {
      recoveryReference.current?.focus();
    }
  }, [state]);

  if (!user) {
    // Preserve the full location (including `?url=`) so login resumes the save.
    const from = `${location.pathname}${location.search}`;
    // Stash the url too, so the cold magic-link and OAuth entries (which land
    // with no `?url=` and null router state) can still resume via the drainer.
    if (url) setPendingSave(url);
    return <Navigate to="/login" state={{ from }} replace />;
  }

  if (state === 'saving') {
    return (
      <main className="flex items-center justify-center min-h-screen bg-[var(--base-bg)] text-[var(--base-alt-text)] select-none">
        <LoadingIndicator message="Saving your link…" />
      </main>
    );
  }

  return (
    <SaveOutcome
      recoveryReference={recoveryReference}
      state={state}
      status={savedStatus}
      url={url}
    />
  );
}
