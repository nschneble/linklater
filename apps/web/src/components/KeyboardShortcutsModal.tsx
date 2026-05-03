import { createPortal } from 'react-dom';
import { useEffect } from 'react';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

const shortcuts = [
  { key: '1', description: 'Show unread links' },
  { key: '2', description: 'Show read links' },
  { key: 'A', description: 'Add link' },
  { key: 'S', description: 'Stumble upon' },
  { key: 'K', description: 'Show shortcuts' },
];

export default function KeyboardShortcutsModal({
  onClose,
}: KeyboardShortcutsModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="fixed z-30 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm p-6 bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl animate-fade-in-up"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-[var(--text)] select-none">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            className="text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors cursor-pointer"
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
              <kbd className="px-2 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text)] text-xs rounded-md font-mono">
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
