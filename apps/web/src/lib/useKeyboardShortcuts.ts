import { useEffect, useRef } from 'react';

interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  isShortcutsModalOpen: boolean;
  onShowUnread: () => void;
  onShowRead: () => void;
  onSearch: () => void;
  onToggleForm: () => void;
  onStumble: () => void;
  onToggleShortcuts: () => void;
  onEscape?: () => void;
}

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

      const target = event.target as HTMLElement;
      const isTypingField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isTypingField) return;

      if (event.key === 'Escape' && onEscapeRef.current) {
        event.preventDefault();
        onEscapeRef.current();
        return;
      }

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
