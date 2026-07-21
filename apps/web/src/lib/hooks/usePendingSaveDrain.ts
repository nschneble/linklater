import { createLink } from '../api';
import { takePendingSave } from '../pendingSave';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from './useToast';
import { useEffect, useRef } from 'react';

const DRAIN_SUCCESS_MESSAGE = "Saved. It's in your reading list.";

/**
 * Resumes a logged-out save once the user is authenticated.
 *
 * A logged-out visitor to `/save?url=` has the url stashed in localStorage
 * before the bounce to `/login` (see `setPendingSave` in SavePage). Password
 * login resumes the save itself by returning to `/save?url=` and re-saving, but
 * the cold magic-link and OAuth entries land on `/unread` with no `?url=` to
 * replay. This hook closes that gap: on the first authenticated render it
 * takes-and-clears the stashed url, saves it, and shows a success toast.
 *
 * Returns the toast message so the host renders a single shared `<Toast>`. Must
 * be mounted inside the authenticated tree only.
 */
export function usePendingSaveDrain(): {
  toastMessage: string | null;
  dismissToast: () => void;
} {
  const { user } = useAuth();
  const { message, show, dismiss } = useToast();
  // Fires the drain a single time per app session. A ref, not an effect dep,
  // because the visibility refresh in useAuthState mints a fresh user object on
  // every tab focus; keying the drain off that identity would re-fire the save.
  // The magic-link and OAuth resumes are cold page loads, so this always starts
  // false for the paths that need it.
  const hasDrainedReference = useRef(false);

  useEffect(() => {
    if (!user || hasDrainedReference.current) return;
    hasDrainedReference.current = true;

    const pending = takePendingSave();
    if (!pending) return;

    createLink({ url: pending })
      .then(() => show(DRAIN_SUCCESS_MESSAGE))
      .catch(() => {
        // Fail quietly. A dropped resume is recoverable (the user can save
        // again) and must never surface an error into a fresh session or block
        // app render. The backend dedups, so a rare double save is harmless.
      });
  }, [user, show]);

  return { toastMessage: message, dismissToast: dismiss };
}
