import { useEffect } from 'react';

interface UsePasteDetectionOptions {
  enabled?: boolean;
  onSave: (url: string) => void;
}

function looksLikeUrl(text: string): boolean {
  return text.startsWith('http://') || text.startsWith('https://');
}

export function usePasteDetection({
  enabled = true,
  onSave,
}: UsePasteDetectionOptions): void {
  useEffect(() => {
    if (!enabled) return;

    function handlePaste(event: ClipboardEvent) {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      const text = (event.clipboardData?.getData('text') ?? '').trim();
      if (looksLikeUrl(text)) {
        onSave(text);
      }
    }

    window.addEventListener('paste', handlePaste);

    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, [enabled, onSave]);
}
