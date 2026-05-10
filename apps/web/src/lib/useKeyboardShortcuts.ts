import { useEffect, useRef } from 'react';

interface UseKeyboardShortcutsOptions {
  /** When `false`, no keyboard events are handled. Use to disable shortcuts while the user is not on the links view. */
  enabled: boolean;
  /** Whether the keyboard shortcuts modal is currently open. Needed so `Z` can close it. */
  isShortcutsModalOpen: boolean;
  /** Called when ESC is pressed. Only used when a close-able element (e.g. the form) is open. */
  onEscape?: () => void;
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
 * - `1`   → Show unread links
 * - `2`   → Show read links
 * - `Q`   → Focus the search input
 * - `A`   → Toggle the link form
 * - `D`   → Stumble upon
 * - `Z`   → Toggle the shortcuts modal
 * - `ESC` → Calls `onEscape` if provided (e.g. closes the link form)
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
  onSearch,
  onShowRead,
  onShowUnread,
  onStumble,
  onToggleForm,
  onToggleShortcuts,
}: UseKeyboardShortcutsOptions) {
  const isShortcutsModalOpenRef = useRef(isShortcutsModalOpen);
  const onEscapeRef = useRef(onEscape);
  const onSearchRef = useRef(onSearch);
  const onShowReadRef = useRef(onShowRead);
  const onShowUnreadRef = useRef(onShowUnread);
  const onStumbleRef = useRef(onStumble);
  const onToggleFormRef = useRef(onToggleForm);
  const onToggleShortcutsRef = useRef(onToggleShortcuts);

  // always keep refs current so the listener uses the latest callbacks
  isShortcutsModalOpenRef.current = isShortcutsModalOpen;
  onEscapeRef.current = onEscape;
  onSearchRef.current = onSearch;
  onShowReadRef.current = onShowRead;
  onShowUnreadRef.current = onShowUnread;
  onStumbleRef.current = onStumble;
  onToggleFormRef.current = onToggleForm;
  onToggleShortcutsRef.current = onToggleShortcuts;

  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape' && onEscapeRef.current) {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }

      const target = event.target as HTMLElement;
      const isTypingField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isTypingField) return;

      if (isShortcutsModalOpenRef.current) {
        if (event.key.toLowerCase() === 'z') {
          event.preventDefault();
          onToggleShortcutsRef.current();
        }
        return;
      }

      switch (event.key.toLowerCase()) {
        case '1':
          event.preventDefault();
          onShowUnreadRef.current();
          break;
        case '2':
          event.preventDefault();
          onShowReadRef.current();
          break;
        case 'q':
          event.preventDefault();
          onSearchRef.current();
          break;
        case 'a':
          event.preventDefault();
          onToggleFormRef.current();
          break;
        case 'd':
          event.preventDefault();
          onStumbleRef.current();
          break;
        case 'z':
          event.preventDefault();
          onToggleShortcutsRef.current();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);
}
