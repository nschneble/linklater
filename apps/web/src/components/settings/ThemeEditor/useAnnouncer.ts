import { useReannounce } from '../../../lib/hooks/useReannounce';

/**
 * Drives the theme editor's single polite live region.
 *
 * The editor announces each settled save (and each engage/revert) through ONE
 * `role="status" aria-live="polite"` region. A live region only fires when its
 * text node CHANGES, so two saves in a row that carry the SAME message string
 * ("Your theme saved." twice) would otherwise stay silent (React sees no
 * change). To re-trigger an identical consecutive utterance, the shared
 * `useReannounce` hook clears the region to `''` then re-sets the message after
 * a 50ms tick, keyed on `savedCount` (which bumps once per settled save /
 * announce). The message is read at fire time via a ref so a consume-once
 * reason set just before the save isn't lost to a stale closure.
 *
 * Returns the string the editor should render inside the live region.
 */
export function useAnnouncer(savedCount: number, savedMessage: string): string {
  return useReannounce(savedCount, savedMessage, 50);
}
