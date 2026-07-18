import { useEffect, useRef } from 'react';

interface UseKeyboardShortcutsOptions {
  /**
   * When `false`, only the single-character shortcuts (1, 2, Q, A, D, Z) are
   * suppressed, satisfying WCAG 2.1.4 (Character Key Shortcuts). The named
   * keys (arrows, Enter, and Escape) stay live regardless, because 2.1.4
   * exempts shortcuts that use only named keys and a keyboard-reliant user
   * still needs list navigation, open, and dismiss. Driven by the device-local
   * keyboard-shortcuts preference in `useLinksView`.
   */
  singleKeyShortcutsEnabled: boolean;
  /** Whether the keyboard shortcuts modal is currently open. Needed so `Z` can close it. */
  isShortcutsModalOpen: boolean;
  /** Called when ESC is pressed. Only used when a close-able element (e.g. the form) is open. */
  onEscape?: () => void;
  /** Called when ArrowDown is pressed, outside of a text field. */
  onNavigateNextLink: () => void;
  /** Called when ArrowUp is pressed, outside of a text field. */
  onNavigatePrevLink: () => void;
  /** Called when Enter is pressed and no interactive element is focused. */
  onOpenSelectedLink: () => void;
  onSearch: () => void;
  onShowRead: () => void;
  onShowUnread: () => void;
  onStumble: () => void;
  onToggleForm: () => void;
  onToggleShortcuts: () => void;
}

/**
 * Registers global keyboard shortcuts for the links view. Shortcuts are
 * disabled when the user is typing in an input or textarea to avoid
 * intercepting normal text entry.
 *
 * Shortcut map:
 * - `↑ / ↓`  → Navigate links and user menu
 * - `← / →`  → Switch tabs (unread / read)
 * - `Enter`  → Open the selected link or menu item
 * - `1`      → Show unread links
 * - `2`      → Show read links
 * - `Q`      → Focus the search input
 * - `A`      → Toggle the link form
 * - `D`      → Stumble!
 * - `Z`      → Toggle the shortcuts modal
 * - `X`      → Toggle the user menu
 * - `ESC`    → Calls `onEscape` if provided
 *
 * When the shortcuts modal is open, only `Z` (close modal) and `ESC` are
 * handled. All other shortcuts are suppressed. If the single-key preference is
 * off, `Z` no longer closes the modal (it is a single-character shortcut), but
 * Escape and the modal's own close controls still dismiss it.
 *
 * GOTCHA: All callbacks and the preference flag are stored in refs so the
 * `keydown` listener is attached exactly once, on mount. The named keys must
 * stay live even while single-key shortcuts are off, so the listener is never
 * torn down for the preference; the flag is read from its ref inside the
 * handler instead. Without refs, the listener would need re-registering on
 * every render to pick up fresh callback references.
 */
export function useKeyboardShortcuts({
  singleKeyShortcutsEnabled,
  isShortcutsModalOpen,
  onEscape,
  onNavigateNextLink,
  onNavigatePrevLink,
  onOpenSelectedLink,
  onSearch,
  onShowRead,
  onShowUnread,
  onStumble,
  onToggleForm,
  onToggleShortcuts,
}: UseKeyboardShortcutsOptions) {
  const singleKeyShortcutsEnabledReference = useRef(singleKeyShortcutsEnabled);
  const isShortcutsModalOpenReference = useRef(isShortcutsModalOpen);
  const onEscapeReference = useRef(onEscape);
  const onNavigateNextLinkReference = useRef(onNavigateNextLink);
  const onNavigatePrevLinkReference = useRef(onNavigatePrevLink);
  const onOpenSelectedLinkReference = useRef(onOpenSelectedLink);
  const onSearchReference = useRef(onSearch);
  const onShowReadReference = useRef(onShowRead);
  const onShowUnreadReference = useRef(onShowUnread);
  const onStumbleReference = useRef(onStumble);
  const onToggleFormReference = useRef(onToggleForm);
  const onToggleShortcutsReference = useRef(onToggleShortcuts);

  // always keep refs current so the listener uses the latest callbacks
  singleKeyShortcutsEnabledReference.current = singleKeyShortcutsEnabled;
  isShortcutsModalOpenReference.current = isShortcutsModalOpen;
  onEscapeReference.current = onEscape;
  onNavigateNextLinkReference.current = onNavigateNextLink;
  onNavigatePrevLinkReference.current = onNavigatePrevLink;
  onOpenSelectedLinkReference.current = onOpenSelectedLink;
  onSearchReference.current = onSearch;
  onShowReadReference.current = onShowRead;
  onShowUnreadReference.current = onShowUnread;
  onStumbleReference.current = onStumble;
  onToggleFormReference.current = onToggleForm;
  onToggleShortcutsReference.current = onToggleShortcuts;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape' && onEscapeReference.current) {
        event.preventDefault();
        onEscapeReference.current();
        return;
      }

      const target = event.target as HTMLElement;
      const isTypingField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isTypingField) return;

      if (isShortcutsModalOpenReference.current) {
        // `Z` is a single-character shortcut, so it only closes the modal when
        // the preference is on. Escape and the modal's own controls still
        // dismiss it either way.
        if (
          singleKeyShortcutsEnabledReference.current &&
          event.key.toLowerCase() === 'z'
        ) {
          event.preventDefault();
          onToggleShortcutsReference.current();
        }
        return;
      }

      // Arrow navigation is handled before keyboard shortcuts so they
      // can't be swallowed by the switch below.
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          onNavigatePrevLinkReference.current();
          return;
        case 'ArrowDown':
          event.preventDefault();
          onNavigateNextLinkReference.current();
          return;
        case 'ArrowLeft':
          event.preventDefault();
          onShowUnreadReference.current();
          return;
        case 'ArrowRight':
          event.preventDefault();
          onShowReadReference.current();
          return;
        case 'Enter': {
          const role =
            target instanceof Element ? target.getAttribute('role') : null;
          const isInteractive =
            target.tagName === 'BUTTON' ||
            target.tagName === 'A' ||
            role === 'link' ||
            role === 'menuitem';
          if (!isInteractive) {
            event.preventDefault();
            onOpenSelectedLinkReference.current();
          }
          return;
        }
      }

      // Single-character shortcuts below are the only handlers gated by the
      // preference (WCAG 2.1.4). The named-key handlers above stay live.
      if (!singleKeyShortcutsEnabledReference.current) return;

      switch (event.key.toLowerCase()) {
        case '1':
          event.preventDefault();
          onShowUnreadReference.current();
          break;
        case '2':
          event.preventDefault();
          onShowReadReference.current();
          break;
        case 'q':
          event.preventDefault();
          onSearchReference.current();
          break;
        case 'a':
          event.preventDefault();
          onToggleFormReference.current();
          break;
        case 'd':
          event.preventDefault();
          onStumbleReference.current();
          break;
        case 'z':
          event.preventDefault();
          onToggleShortcutsReference.current();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);
}
