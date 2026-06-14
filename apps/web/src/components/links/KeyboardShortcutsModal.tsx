import Modal from '../common/Modal';

interface KeyboardShortcutsModalProps {
  /** Called when the user presses Escape or clicks the close button or backdrop. */
  onClose: () => void;
}

/** The shortcuts displayed in the modal. Must stay in sync with `useKeyboardShortcuts`. */
const shortcuts = [
  { key: '↑ / ↓', description: 'Navigate links / menu' },
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
 *
 * ARIA wiring, focus management, body-scroll lock, and the close + backdrop
 * buttons are owned by `<Modal>` — see `Modal.tsx`. Lazy-loaded from
 * `LinksView` to keep it out of the initial bundle.
 */
export default function KeyboardShortcutsModal({
  onClose,
}: KeyboardShortcutsModalProps) {
  return (
    <Modal
      labelledBy={HEADING_ID}
      onClose={onClose}
      closeLabel="Close keyboard shortcuts"
      backdropLabel="Close shortcuts"
      panelClassName="max-w-xs pt-5.5 px-6 pb-6 rounded-xl"
    >
      <h2
        id={HEADING_ID}
        tabIndex={-1}
        data-modal-initial-focus
        className="mb-7.5 text-sm font-semibold text-[var(--orbit-text)] text-balance focus:outline-none"
      >
        Keyboard shortcuts
      </h2>
      <ul className="space-y-3">
        {shortcuts.map(({ key, description }) => (
          <li key={key} className="flex items-center justify-between">
            <span className="text-[var(--orbit-alt-text)] text-sm">
              {description}
            </span>
            <kbd className="px-2 py-0.5 bg-[var(--orbit-bg)] border-shadow text-[var(--orbit-text)] text-xs rounded-md font-mono">
              {key}
            </kbd>
          </li>
        ))}
      </ul>
    </Modal>
  );
}
