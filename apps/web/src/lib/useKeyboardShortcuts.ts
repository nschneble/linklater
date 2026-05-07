import { useEffect, useRef } from 'react';

interface UseKeyboardShortcutsOptions {
  /** When `false`, no keyboard events are handled. Use to disable shortcuts while the user is not on the links view. */
  enabled: boolean;
  /** Whether the keyboard shortcuts modal is currently open. Needed so `Z` can close it. */
  isShortcutsModalOpen: boolean;
  onShowUnread: () => void;
  onShowRead: () => void;
  onSearch: () => void;
  onToggleForm: () => void;
  onStumble: () => void;
  onToggleShortcuts: () => void;
  /** Called when Escape is pressed. Optional — only used when a closeable element (e.g. the form) is open. */
  onEscape?: () => void;
}

/**
 * Registers global keyboard shortcuts for the links view. Shortcuts are
 * disabled when the user is typing in an input or textarea to avoid
 * intercepting normal text entry.
 *
 * Shortcut map:
 * - `1` → Show unread links
 * - `2` → Show read links
 * - `Q` → Focus the search input
 * - `A` → Toggle the link form
 * - `D` → Stumble upon (random link)
 * - `Z` → Toggle the shortcuts modal
 * - `Escape` → Calls `onEscape` if provided (e.g. close the link form)
 *
 * When the shortcuts modal is open, only `Z` (close modal) and `Escape` are
 * handled — all other shortcuts are suppressed.
 *
 * GOTCHA: All callbacks are stored in refs so the `keydown` listener only
 * needs to be attached once (when `enabled` changes). Without refs, the
 * listener would need to be re-registered on every render to pick up fresh
 * callback references.
 *
 * Side effects: adds and removes a `keydown` event listener on `document`.
 */
export function useKeyboardShortcuts({
  enabled,
  isShortcutsModalOpen,
  onShowUnread,
  onShowRead,
  onSearch,
  onToggleForm,
  onStumble,
  onToggleShortcuts,
  onEscape,
}: UseKeyboardShortcutsOptions) {
  const isShortcutsModalOpenRef = useRef(isShortcutsModalOpen);
  const onShowUnreadRef = useRef(onShowUnread);
  const onShowReadRef = useRef(onShowRead);
  const onSearchRef = useRef(onSearch);
  const onToggleFormRef = useRef(onToggleForm);
  const onStumbleRef = useRef(onStumble);
  const onToggleShortcutsRef = useRef(onToggleShortcuts);
  const onEscapeRef = useRef(onEscape);

  // Always keep refs current so the stable listener uses the latest callbacks.
  isShortcutsModalOpenRef.current = isShortcutsModalOpen;
  onShowUnreadRef.current = onShowUnread;
  onShowReadRef.current = onShowRead;
  onSearchRef.current = onSearch;
  onToggleFormRef.current = onToggleForm;
  onStumbleRef.current = onStumble;
  onToggleShortcutsRef.current = onToggleShortcuts;
  onEscapeRef.current = onEscape;

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
