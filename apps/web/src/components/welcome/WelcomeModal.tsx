import Modal, { type ModalControl } from '../common/Modal';
import PrimaryButton from '../common/PrimaryButton';
import { useNavigate } from 'react-router-dom';
import { useRef } from 'react';

interface WelcomeModalProps {
  /** Called when the user dismisses the modal via the close button, Escape, or backdrop. */
  onClose: () => void;
}

const HEADING_ID = 'welcome-heading';
const DESCRIPTION_ID = 'welcome-description';

/**
 * One-shot welcome modal shown on the user's first authenticated session.
 * Greets the user, gives a short forward-looking tagline, and surfaces two
 * existing features (the bookmarklet and Stumble) that new users tend to
 * miss. Mounted from `AppShell` whenever `user.welcomedAt` is `null`.
 *
 * ARIA wiring, focus management, body-scroll lock, and the close + backdrop
 * buttons are owned by `<Modal>` – see `Modal.tsx`. The bookmarklet and
 * Stumble actions navigate away on click, so we suppress focus restoration
 * (via `controlRef.current?.skipRestore()`) before closing; the trigger
 * that opened the modal may no longer be in the tab order after the route
 * change, and `SettingsView` moves focus to the target section instead.
 *
 * Lazy-loaded from `AppShell` to keep it out of the initial bundle.
 */
export default function WelcomeModal({ onClose }: WelcomeModalProps) {
  const controlReference = useRef<ModalControl | null>(null);
  const navigate = useNavigate();

  const handleNavigate = (
    path: string,
    options?: { state: { scrollTo: string } },
  ) => {
    controlReference.current?.skipRestore();
    onClose();
    navigate(path, options);
  };

  return (
    <Modal
      labelledBy={HEADING_ID}
      describedBy={DESCRIPTION_ID}
      onClose={onClose}
      closeLabel="Close welcome"
      backdropLabel="Dismiss welcome dialog"
      controlRef={controlReference}
    >
      <div className="space-y-8">
        <div className="space-y-1 text-center">
          <h2
            id={HEADING_ID}
            tabIndex={-1}
            data-modal-initial-focus
            className="text-[var(--orbit-text)] text-2xl font-bold text-balance focus:outline-none"
          >
            Welcome to Linklater!
          </h2>
          <p
            id={DESCRIPTION_ID}
            className="text-[var(--orbit-alt-text)] text-sm text-pretty"
          >
            Two features worth knowing before you dive in.
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-[var(--orbit-bg)] border border-[var(--orbit-border)] rounded-xl animate-fade-in-up [animation-delay:120ms]">
            <i
              className="mt-0.5 text-[var(--orbit-alt-text)] text-2xl fa-solid fa-book-bookmark"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-sm text-pretty">
                <span className="text-[var(--orbit-text)] font-semibold">
                  The Linklater bookmarklet is a pretty sweet way to save
                  links.{' '}
                </span>
                <span className="text-[var(--orbit-alt-text)]">
                  Drag it to your bookmarks bar, then click it on any page to
                  save the link directly to Linklater.
                </span>
              </p>
              <PrimaryButton
                surface="orbit"
                className="w-full mt-4"
                onClick={() =>
                  handleNavigate('/settings', {
                    state: { scrollTo: 'bookmarks' },
                  })
                }
              >
                <i
                  className="fa-solid fa-bookmark text-[0.7rem]"
                  aria-hidden="true"
                />
                Get the bookmarklet
              </PrimaryButton>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-[var(--orbit-bg)] border border-[var(--orbit-border)] rounded-xl animate-fade-in-up [animation-delay:200ms]">
            <i
              className="mt-0.5 text-[var(--orbit-alt-text)] text-2xl fa-solid fa-dice"
              aria-hidden="true"
            />
            <div className="flex-1">
              <p className="text-sm text-pretty">
                <span className="text-[var(--orbit-text)] font-semibold">
                  The Linklater "Stumble!" feature brings back the casual fun of
                  discovery.{' '}
                </span>
                <span className="text-[var(--orbit-alt-text)]">
                  Visit the page to instantly open a random unread link from
                  your collection.
                </span>
              </p>
              <PrimaryButton
                surface="orbit"
                className="w-full mt-4"
                onClick={() => handleNavigate('/stumble')}
              >
                <i
                  className="fa-brands fa-stumbleupon text-[0.7rem]"
                  aria-hidden="true"
                />
                Try Stumble!
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
