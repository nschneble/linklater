import MockHeader from './MockHeader';
import MockLinkCard from './MockLinkCard';
import MockMenu from './MockMenu';
import MockNotifications from './MockNotifications';
import MockToolbar from './MockToolbar';

/**
 * A live, decorative miniature of the Linklater app, painted with the current
 * theme tokens. It is a PICTURE of the app, not the app: 100% static (no
 * state, no handlers) with zero focusable descendants, so the entire mock is
 * wrapped in a single `aria-hidden` container and skipped by the Tab order and
 * the screen-reader cursor. An `sr-only` summary sibling (rendered outside the
 * hidden subtree) tells assistive-tech users what the panel is for.
 *
 * One composed frame exercises every theme bundle and slot in realistic
 * context — base (page frame + toolbar), mount (link card), orbit (header +
 * open menu), and alert/warn/info/success (the notification stack) — so users
 * editing custom-theme colors can verify each contrast pair at a glance.
 */
export default function ComponentShowcase() {
  return (
    <>
      <p className="sr-only">
        Live visual preview of the app painted with your current colors.
        Contrast results are reported in the Contrast panel.
      </p>
      <div
        aria-hidden="true"
        data-testid="app-mock"
        className="overflow-hidden bg-[var(--base-bg)] border border-[var(--base-border)] rounded-xl"
      >
        <MockHeader />
        <div className="pb-4">
          <MockToolbar />
          <div className="relative px-4 pt-3">
            <MockLinkCard />
            <div className="absolute right-5 top-6">
              <MockMenu />
            </div>
          </div>
        </div>
        <MockNotifications />
      </div>
    </>
  );
}
