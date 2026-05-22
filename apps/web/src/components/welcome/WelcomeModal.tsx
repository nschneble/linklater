import IconButton from '../common/IconButton';
import PrimaryButton from '../common/PrimaryButton';
import { createPortal } from 'react-dom';
import { useEffect, useRef } from 'react';
import { useFocusReturn } from '../../lib/hooks/useFocusReturn';
import { useFocusTrap } from '../../lib/hooks/useFocusTrap';
import { useNavigate } from 'react-router-dom';

interface WelcomeModalProps {
  /** Called when the user dismisses the modal via the button, Escape, or backdrop. */
  onClose: () => void;
}

const HEADING_ID = 'welcome-heading';
const DESCRIPTION_ID = 'welcome-description';

/**
 * One-shot welcome modal shown on the user's first authenticated session.
 * Greets the user, gives a one-paragraph overview of the app, and surfaces
 * two existing features (the bookmarklet and stumble) that new users tend
 * to miss. Mounted from `AppShell` whenever `user.welcomedAt` is `null`.
 *
 * Accessibility:
 * - `role="dialog"` with `aria-modal="true"`, `aria-labelledby`, and `aria-describedby`.
 * - Initial focus moves to the heading (least-destructive target per WAI-ARIA APG)
 *   so the first Tab moves into the action links and the primary "Got it" button
 *   sits at the end of the tab order.
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

  useFocusReturn(true);
  useFocusTrap(dialogReference, { onEscape: onClose });

  // Focus the heading on mount. Heading is tabbable only programmatically
  // (tabIndex=-1) so it does not appear in the keyboard tab cycle — Tab from
  // here moves into the first action link, which is the desired flow.
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
        <div className="space-y-10">
          <div className="space-y-1">
            <h2
              ref={headingReference}
              id={HEADING_ID}
              tabIndex={-1}
              className="text-[var(--text)] text-lg font-semibold text-balance focus:outline-none"
            >
              Welcome to Linklater!
            </h2>
            <p
              id={DESCRIPTION_ID}
              className="text-[var(--text-muted)] text-sm text-pretty"
            >
              So, um… what now?
            </p>
          </div>
          <div className="space-y-5">
            <div className="flex items-start gap-3 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
              <span class="fa-stack fa-xl text-[var(--text-subtle)]">
                <i class="fa-solid fa-bookmark fa-stack-2x"></i>
                <i class="fa-solid fa-share fa-stack-1x fa-inverse"></i>
              </span>
              <div className="flex-1">
                <p className="text-[var(--text-muted)] text-sm text-pretty">
                  <span className="font-semibold">
                    The Linklater bookmarklet is a pretty sweet way to save
                    links.
                  </span>{' '}
                  Drag it to your bookmarks bar, then click it on any page to
                  save the link directly to Linklater.{' '}
                </p>
                <IconButton
                  variant="elevated"
                  className="w-full mt-4"
                  onClick={() => navigate('/settings#bookmarklet')}
                >
                  <i
                    className="fa-solid fa-book-bookmark text-[0.7rem]"
                    aria-hidden="true"
                  />
                  Get the bookmarklet
                </IconButton>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
              <span class="fa-stack fa-xl text-[var(--text-subtle)]">
                <i class="fa-solid fa-laptop fa-stack-2x"></i>
                <i class="fa-brands fa-stumbleupon fa-stack-1x fa-inverse"></i>
              </span>
              <div className="flex-1">
                <p className="text-[var(--text-muted)] text-sm text-pretty">
                  <span className="font-semibold">
                    The Linklater "Stumble!" feature brings back the casual fun
                    of discovery.{' '}
                  </span>
                  Visit the page to instantly open a random unread link from
                  your collection.
                </p>
                <IconButton
                  variant="elevated"
                  className="w-full mt-4"
                  onClick={() => navigate('/settings#stumble')}
                >
                  <i
                    className="fa-solid fa-shuffle text-[0.7rem]"
                    aria-hidden="true"
                  />
                  Get the link
                </IconButton>
              </div>
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <PrimaryButton type="button" onClick={onClose}>
              Close welcome
            </PrimaryButton>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
