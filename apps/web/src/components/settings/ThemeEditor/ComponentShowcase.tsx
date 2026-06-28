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
 * the screen-reader cursor.
 *
 * The right column of the editor has no visible heading — the mock already
 * looks like the app, so a card-in-a-card "Components" frame would be redundant.
 * For assistive tech the region is fronted by an `sr-only` <h2> "Live preview"
 * (sibling to the left column's "Colors" h2 under the page <h1>) plus an
 * `sr-only` orientation summary, BOTH rendered OUTSIDE the hidden subtree so
 * they stay perceivable while the decorative mock stays hidden.
 *
 * One composed frame exercises every theme bundle and slot in realistic
 * context — base (page frame + toolbar), mount (link card), orbit (header +
 * open user menu), and alert/warn/info/success (the notification stack) — so
 * users editing custom-theme colors can verify each contrast pair at a glance.
 */
export default function ComponentShowcase() {
  return (
    <>
      <h2 className="sr-only">Live preview</h2>
      <p className="sr-only">
        A visual preview of the app painted with your current colors. Contrast
        issues are flagged on the affected color controls.
      </p>
      <div
        aria-hidden="true"
        data-testid="app-mock"
        className="relative overflow-hidden bg-[var(--base-bg)] border border-[var(--base-border)] rounded-xl"
      >
        <MockHeader />
        {/* The open user menu drops from the top-right avatar, overlaying the
            content the way the real dropdown does. It is inset within the frame
            so it is never clipped and never buried mid-card. */}
        <div className="absolute right-3 top-11 z-10">
          <MockMenu />
        </div>
        <div className="pb-4">
          <MockToolbar />
          <div className="px-4 pt-3">
            <MockLinkCard />
          </div>
        </div>
        <MockNotifications />
      </div>
    </>
  );
}
