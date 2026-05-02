import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  enabled: boolean;
  onShowUnread: () => void;
  onShowRead: () => void;
  onToggleForm: () => void;
  onStumble: () => void;
  onToggleShortcuts: () => void;
}

export function useKeyboardShortcuts({
  enabled,
  onShowUnread,
  onShowRead,
  onToggleForm,
  onStumble,
  onToggleShortcuts,
}: UseKeyboardShortcutsOptions) {
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

      switch (event.key) {
        case '1':
          event.preventDefault();
          onShowUnread();
          break;
        case '2':
          event.preventDefault();
          onShowRead();
          break;
        case 'a':
        case 'A':
          event.preventDefault();
          onToggleForm();
          break;
        case 's':
        case 'S':
          event.preventDefault();
          onStumble();
          break;
        case 'k':
        case 'K':
          event.preventDefault();
          onToggleShortcuts();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    onShowUnread,
    onShowRead,
    onToggleForm,
    onStumble,
    onToggleShortcuts,
  ]);
}
