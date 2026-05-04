import { useEffect, type RefObject } from 'react';

export function useMenuNavigation(
  containerReference: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  useEffect(() => {
    const container = containerReference.current;
    if (!container) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key !== 'ArrowDown' &&
        event.key !== 'ArrowUp' &&
        event.key !== 'Escape'
      ) {
        return;
      }

      if (event.key === 'Escape') {
        onClose();
        return;
      }

      const items = Array.from(
        container!.querySelectorAll<HTMLElement>('[role="menuitem"]'),
      );
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      if (currentIndex === -1) return;

      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex = (currentIndex + direction + items.length) % items.length;
      items[nextIndex].focus();
    }

    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [containerReference, onClose]);
}
