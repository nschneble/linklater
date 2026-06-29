import MockHeader from './MockHeader';
import MockLinkCard from './MockLinkCard';
import MockMenu from './MockMenu';
import MockNotice from './MockNotice';
import MockToolbar from './MockToolbar';
import { useId } from 'react';
import type { Bundle } from './useThemeOverrides';
import type { CSSProperties } from 'react';

interface ComponentShowcaseProps {
  /**
   * The bundle the editor is currently editing. The showcase mirrors the SAME
   * `activeBundle` the tablist drives, so it always previews the component that
   * bundle paints — never an everything-at-once montage (PRD point 4).
   */
  activeBundle: Bundle;
  /**
   * The custom-palette inline style scoped to the decorative mock ONLY: while a
   * copy-menu row is hovered this is the hovered film theme; otherwise it is the
   * editor's live custom palette. The precedence logic is unchanged from W2 —
   * only its mount point moved DOWN here, onto the aria-hidden mock container, so
   * the left Colors card now renders in the APP THEME (PRD point 9 inversion).
   */
  previewStyle: CSSProperties | null;
  /** The resolved custom palette, applied to the mock when no preview is active. */
  contentThemeStyle: CSSProperties;
}

/**
 * A short, honest sentence per bundle, describing where in the real app that
 * bundle's colors are used. This copy is REAL app UI (it lives OUTSIDE the
 * aria-hidden mock subtree, in the accessibility tree) so it must read as the
 * app's own voice — concise, truthful, no marketing. The orchestrator runs a
 * copy-polish pass in a later wave; these are accurate placeholders.
 */
export const BUNDLE_EXPLANATIONS: Record<Bundle, string> = {
  base: 'Used for the page itself: your links toolbar, search field, and tabs.',
  mount: 'Used for your saved-link cards.',
  orbit: 'Used for the top bar and your account menu.',
  alert: 'Used for error notices, e.g. “We couldn’t open that link.”',
  warn: 'Used for warning banners, e.g. read links being removed.',
  info: 'Used for tips and hints.',
  success: 'Used for success toasts, e.g. “Link saved!”',
};

/**
 * The decorative mock for the active bundle — the real component that bundle
 * paints, drawn at app scale: base shows the page frame + toolbar; mount shows
 * a link card; orbit shows the header with its account menu; and each status
 * bundle shows its matching notice. Each mirrors its real counterpart's
 * structure (real border widths, real accent placement) but is 100% static —
 * zero focusable descendants, no handlers, no interactive roles (the parent
 * wraps it in a single aria-hidden container).
 */
function BundleMock({ bundle }: { bundle: Bundle }) {
  if (bundle === 'base') {
    return (
      <div className="pb-4 bg-[var(--base-bg)]">
        <MockToolbar />
      </div>
    );
  }
  if (bundle === 'mount') {
    return (
      <div className="p-4 bg-[var(--base-bg)]">
        <MockLinkCard />
      </div>
    );
  }
  if (bundle === 'orbit') {
    return (
      <div className="relative bg-[var(--base-bg)]">
        <MockHeader />
        {/* The open account menu drops from the top-right avatar, overlaying the
            content the way the real dropdown does — inset so it is never
            clipped. */}
        <div className="absolute right-3 top-12 z-10">
          <MockMenu />
        </div>
        <div className="h-32" />
      </div>
    );
  }
  return (
    <div className="p-4 bg-[var(--base-bg)]">
      <MockNotice
        bundle={bundle}
        icon={STATUS_ICONS[bundle]}
        title={STATUS_COPY[bundle].title}
        detail={STATUS_COPY[bundle].detail}
      />
    </div>
  );
}

type StatusBundle = 'alert' | 'warn' | 'info' | 'success';

const STATUS_ICONS: Record<StatusBundle, string> = {
  warn: 'fa-solid fa-triangle-exclamation',
  info: 'fa-solid fa-lightbulb',
  alert: 'fa-solid fa-circle-xmark',
  success: 'fa-solid fa-circle-check',
};

const STATUS_COPY: Record<StatusBundle, { title: string; detail: string }> = {
  warn: {
    title: 'Read links are removed after seven days',
    detail: 'Move anything you want to keep back to Unread.',
  },
  info: {
    title: 'Tip: drag a link to reorder it',
    detail: 'Your order syncs across every device.',
  },
  alert: {
    title: 'We couldn’t open that link',
    detail: 'The site may be down. Try again in a moment.',
  },
  success: {
    title: 'Link saved!',
    detail: 'Added to Unread and synced everywhere.',
  },
};

/**
 * The right-hand live preview: a named region fronted by an `sr-only` "Live
 * preview" h2 (parity with the left "Colors" region), then a VISIBLE, app-themed
 * sentence describing where the active bundle's colors are used, then the
 * decorative mock of the component that bundle paints.
 *
 * The mock is a PICTURE of the app, not the app: 100% static (no state, no
 * handlers) with zero focusable descendants, wrapped in a single `aria-hidden`
 * container and skipped by the Tab order and the screen-reader cursor. ONLY that
 * container carries the custom palette (`previewStyle ?? contentThemeStyle`) — so
 * the user previews their colors (including bad contrast, which is the point)
 * while the explanation and heading render in the always-readable app theme.
 *
 * Swapping the bundle/mode swaps the mock SILENTLY: the activated tab already
 * self-voices, so there is no live region and no focus move here (the showcase
 * has no focusable elements to steal focus to).
 */
export default function ComponentShowcase({
  activeBundle,
  previewStyle,
  contentThemeStyle,
}: ComponentShowcaseProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="sr-only">
        Live preview
      </h2>
      <p className="text-[var(--base-alt-text)] text-xs">
        {BUNDLE_EXPLANATIONS[activeBundle]}
      </p>
      <div
        aria-hidden="true"
        data-testid="app-mock"
        className="relative overflow-hidden bg-[var(--base-bg)] border border-[var(--base-border)] rounded-xl"
        style={previewStyle ?? contentThemeStyle}
      >
        <BundleMock bundle={activeBundle} />
      </div>
    </section>
  );
}
