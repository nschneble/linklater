import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';
import { FOCUS_RING } from '../../lib/styles';

interface KeyboardShortcutsModalProps {
  /** Called when the user presses Escape or clicks the close button or backdrop. */
  onClose: () => void;
}

/** The shortcuts displayed in the modal. Must stay in sync with `useKeyboardShortcuts`. */
const shortcuts = [
  { key: '↑ / ↓', description: 'Navigate links / user menu' },
  { key: '← / →', description: 'Switch tabs' },
  { key: 'Enter', description: 'Open link / menu item' },
  { key: '1', description: 'Show unread links' },
  { key: '2', description: 'Show read links' },
  { key: 'Q', description: 'Search' },
  { key: 'A', description: 'Add link' },
  { key: 'D', description: 'Stumble!' },
  { key: 'Z', description: 'Show shortcuts' },
  { key: 'X', description: 'Show user menu' },
];

const HEADING_ID = 'keyboard-shortcuts-heading';

/**
 * Modal dialog listing all keyboard shortcuts available in `LinksView`.
 * Rendered via `createPortal` into `document.body` so it layers above all
 * other content.
 *
 * Accessibility:
 * - `role="dialog"` with `aria-modal="true"` and `aria-labelledby`.
 * - Focus is moved to the first focusable element on open and restored to the
 *   previously focused element on close.
 * - Tab key is trapped within the modal.
 * - Escape key closes the modal.
 *
 * Lazy-loaded from `LinksView` to keep it out of the initial bundle.
 */
export default function KeyboardShortcutsModal({
  onClose,
}: KeyboardShortcutsModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    return () => {
      previouslyFocusedElement.current?.focus();
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusableElements = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <>
      <div
        aria-hidden="true"
        data-testid="modal-backdrop"
        className="fixed inset-0 z-20 w-full h-full bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className="fixed z-30 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-xs p-6 bg-[var(--bg-surface)] border-shadow rounded-xl select-none animate-fade-in-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby={HEADING_ID}
      >
        <div className="flex items-center justify-between mb-7.5">
          <h2
            id={HEADING_ID}
            className="text-sm font-semibold text-[var(--text)] text-balance"
          >
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            className={`flex items-center justify-center w-8 h-8 -mr-1 text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors active:scale-[0.96] transition-transform cursor-pointer rounded-full ${FOCUS_RING}`}
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
          >
            <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
          </button>
        </div>
        <ul className="space-y-3">
          {shortcuts.map(({ key, description }) => (
            <li key={key} className="flex items-center justify-between">
              <span className="text-[var(--text-muted)] text-sm">
                {description}
              </span>
              <kbd className="px-2 py-0.5 bg-[var(--bg-elevated)] border-shadow text-[var(--text)] text-xs rounded-md font-mono">
                {key}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </>,
    document.body,
  );
}
