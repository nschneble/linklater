import StumbleEmptyView from './StumbleEmptyView';
import { stumbleLink } from '../lib/api';
import { useEffect, useState } from 'react';

type StumbleState = 'loading' | 'redirecting' | 'empty';

/**
 * Standalone page rendered at `/stumble`. On mount it calls
 * `POST /links/stumble`, which atomically picks a random unread link and
 * marks it as read.
 *
 * When a link is found, it replaces the current browser tab with the link
 * URL, making Linklater invisible in the flow. When no unread links exist,
 * it renders `StumbleEmptyView` instead.
 *
 * This component intentionally has no AppShell wrapper. The user should
 * either leave the page immediately or land on the dedicated empty state.
 */
export default function StumblePage() {
  const [state, setState] = useState<StumbleState>('loading');

  useEffect(() => {
    stumbleLink()
      .then((result) => {
        if (result.url) {
          setState('redirecting');
          window.location.href = result.url;
        } else {
          setState('empty');
        }
      })
      .catch(() => setState('empty'));
  }, []);

  if (state === 'empty') return <StumbleEmptyView />;

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg)] text-[var(--text-muted)] select-none">
      <p className="text-sm animate-pulse">Hang on…</p>
    </div>
  );
}
