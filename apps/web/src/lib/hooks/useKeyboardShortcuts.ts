import { useEffect, useRef } from 'react';

interface UseKeyboardShortcutsOptions {
  /**
   * When `false`, no keyboard events are handled. Driven by two conditions in
   * `useLinksView`: shortcuts are only live on the links view, and only when
   * the user's keyboard-shortcuts preference is on. Disabling that preference
   * turns off every handler here, satisfying WCAG 2.1.4 (Character Key
   * Shortcuts).
   */
  enabled: boolean;
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
 * handled. All other shortcuts are suppressed.
 *
 * GOTCHA: All callbacks are stored in refs so the `keydown` listener only
 * needs to be attached once, when `enabled` changes. Without refs, the
 * listener would need to be re-registered on every render to pick up fresh
 * callback references.
 */
export function useKeyboardShortcuts({
  enabled,
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
    if (!enabled) return;

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
        if (event.key.toLowerCase() === 'z') {
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
  }, [enabled]);
}
