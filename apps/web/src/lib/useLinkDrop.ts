import { useEffect } from 'react';

interface UseLinkDropOptions {
  onSave: (url: string) => void;
}

function looksLikeUrl(text: string): boolean {
  return text.startsWith('http://') || text.startsWith('https://');
}

export function useLinkDrop({ onSave }: UseLinkDropOptions): void {
  useEffect(() => {
    function handleDragEnter(event: DragEvent) {
      event.preventDefault();
    }

    function handleDragOver(event: DragEvent) {
      event.preventDefault();
    }

    function handleDrop(event: DragEvent) {
      event.preventDefault();
      const text =
        event.dataTransfer?.getData('text/uri-list') ||
        event.dataTransfer?.getData('text/plain') ||
        '';
      if (looksLikeUrl(text)) {
        onSave(text.trim());
      }
    }

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [onSave]);
}
