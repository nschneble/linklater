import { useEffect } from 'react';

interface UsePasteDetectionOptions {
  onSave: (url: string) => void;
}

function looksLikeUrl(text: string): boolean {
  return text.startsWith('http://') || text.startsWith('https://');
}

export function usePasteDetection({ onSave }: UsePasteDetectionOptions): void {
  useEffect(() => {
    function handlePaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const text = event.clipboardData?.getData('text') ?? '';
      if (looksLikeUrl(text)) {
        onSave(text.trim());
      }
    }

    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [onSave]);
}
