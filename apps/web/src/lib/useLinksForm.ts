import { useCallback, useState } from 'react';
import { usePasteDetection } from './usePasteDetection';

/**
 * Options for `useLinksForm`.
 */
interface UseLinksFormOptions {
  /**
   * When `false`, global paste detection is disabled (used on the archived tab
   * where pasting a URL should not save a new link).
   *
   * @default true
   */
  enabled?: boolean;
  /** Called with the pasted URL when a valid URL is detected on the page. */
  onDirectSave: (url: string) => Promise<void>;
}

/** Everything exposed by `useLinksForm`. */
export interface UseLinksFormResult {
  /** Toggles the inline link form open or closed. */
  handleToggleForm: () => void;
  /** `true` when the inline link form is currently open. */
  showLinkForm: boolean;
}

/**
 * Manages the visibility of the inline link-creation form and activates the
 * global paste detector when the form is not being explicitly used.
 *
 * @param options - Configuration for paste detection and the direct-save callback.
 * @returns Form visibility state and a toggle handler.
 *
 * @sideEffects
 * Registers a `paste` event listener on `document` (via `usePasteDetection`)
 * while `enabled` is `true`. The listener is cleaned up on unmount.
 */
export function useLinksForm({
  enabled = true,
  onDirectSave,
}: UseLinksFormOptions): UseLinksFormResult {
  const [showLinkForm, setShowLinkForm] = useState(false);

  usePasteDetection({ enabled, onSave: onDirectSave });

  const handleToggleForm = useCallback(() => {
    setShowLinkForm((open) => !open);
  }, []);

  return { handleToggleForm, showLinkForm };
}
