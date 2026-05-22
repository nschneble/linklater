import IconButton from '../common/IconButton';
import { createPortal } from 'react-dom';
import { FOCUS_RING } from '../../lib/styles';
import { useEffect, useRef } from 'react';
import { useFocusReturn } from '../../lib/hooks/useFocusReturn';
import { useFocusTrap } from '../../lib/hooks/useFocusTrap';
import { useNavigate } from 'react-router-dom';

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
 * Accessibility:
 * - `role="dialog"` with `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`.
 * - Initial focus moves to the heading (least-destructive target per WAI-ARIA APG)
 *   so the first Tab moves into the feature action buttons. The dismiss control
 *   is placed first in DOM order, mirroring the app-wide modal convention
 *   established by `KeyboardShortcutsModal`.
 * - Tab key is trapped within the modal; Escape dismisses; focus returns to the
 *   previously focused element on unmount.
 * - Body scroll is locked while the modal is open to prevent disorienting
 *   background scroll on small viewports.
 *
 * Lazy-loaded from `AppShell` to keep it out of the initial bundle.
 */
export default function WelcomeModal({ onClose }: WelcomeModalProps) {
  const dialogReference = useRef<HTMLDivElement>(null);
  const headingReference = useRef<HTMLHeadingElement>(null);
  const navigate = useNavigate();

  const { skipRestore } = useFocusReturn(true);
  useFocusTrap(dialogReference, { onEscape: onClose });

  // Used by the bookmarklet/stumble action buttons: dismiss the modal and
  // navigate to the corresponding section in Settings. Focus restoration is
  // suppressed because the trigger that opened the modal may no longer be
  // in the tab order after the route change; SettingsView moves focus to
  // the target section instead.
  const handleSectionLink = (path: string) => {
    skipRestore();
    onClose();
    navigate(path);
  };

  // Focus the heading on mount. Heading is tabbable only programmatically
  // (tabIndex=-1) so it does not appear in the keyboard tab cycle — Tab from
  // here moves into the first action button, which is the desired flow.
  useEffect(() => {
    headingReference.current?.focus();
  }, []);

  // Lock background scroll while the modal is mounted. Prevents the page
  // behind the backdrop from scrolling on zoomed-in or small viewports.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return createPortal(
    <>
      <div
        aria-hidden="true"
        data-testid="modal-backdrop"
        className="fixed inset-0 z-20 w-full h-full bg-black/50 backdrop-blur-sm cursor-default"
        onClick={onClose}
      />
      <div
        ref={dialogReference}
        className="fixed z-30 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-7 bg-[var(--bg-surface)] border-shadow rounded-2xl select-none animate-fade-in-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby={HEADING_ID}
        aria-describedby={DESCRIPTION_ID}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close welcome"
          className={`absolute top-4 right-4 flex items-center justify-center w-8 h-8 text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors active:scale-[0.96] cursor-pointer rounded-full ${FOCUS_RING}`}
        >
          <i className="fa-solid fa-xmark text-sm" aria-hidden="true" />
        </button>
        <div className="space-y-8">
          <div className="space-y-1 text-center">
            <h2
              ref={headingReference}
              id={HEADING_ID}
              tabIndex={-1}
              className="text-[var(--text)] text-2xl font-bold text-balance focus:outline-none"
            >
              Welcome to Linklater!
            </h2>
            <p
              id={DESCRIPTION_ID}
              className="text-[var(--text-muted)] text-sm text-pretty"
            >
              Two features worth knowing before you dive in.
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl animate-fade-in-up [animation-delay:120ms]">
              <i
                className="mt-0.5 text-[var(--text-subtle)] text-2xl fa-solid fa-book-bookmark"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-sm text-pretty">
                  <span className="text-[var(--text)] font-semibold">
                    The Linklater bookmarklet is a pretty sweet way to save
                    links.{' '}
                  </span>
                  <span className="text-[var(--text-muted)]">
                    Drag it to your bookmarks bar, then click it on any page to
                    save the link directly to Linklater.
                  </span>
                </p>
                <IconButton
                  variant="elevated"
                  className="w-full mt-4"
                  onClick={() => handleSectionLink('/settings#bookmarklet')}
                >
                  <i
                    className="fa-solid fa-bookmark text-[0.7rem]"
                    aria-hidden="true"
                  />
                  Get the bookmarklet
                </IconButton>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl animate-fade-in-up [animation-delay:200ms]">
              <i
                className="mt-0.5 text-[var(--text-subtle)] text-2xl fa-solid fa-dice"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-sm text-pretty">
                  <span className="text-[var(--text)] font-semibold">
                    The Linklater "Stumble!" feature brings back the casual fun
                    of discovery.{' '}
                  </span>
                  <span className="text-[var(--text-muted)]">
                    Visit the page to instantly open a random unread link from
                    your collection.
                  </span>
                </p>
                <IconButton
                  variant="elevated"
                  className="w-full mt-4"
                  onClick={() => handleSectionLink('/stumble')}
                >
                  <i
                    className="fa-brands fa-stumbleupon text-[0.7rem]"
                    aria-hidden="true"
                  />
                  Try Stumble!
                </IconButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
