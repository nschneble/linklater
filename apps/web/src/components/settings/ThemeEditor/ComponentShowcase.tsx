import MockHeader from './MockHeader';
import MockLinkCard from './MockLinkCard';
import MockMenu from './MockMenu';
import MockNotice from './MockNotice';
import MockToolbar from './MockToolbar';
import { MOCK_STATUS_GLYPHS } from './mockGlyphs';
import { Children, useId } from 'react';
import type { Bundle } from './useThemeOverrides';
import type { Mode } from '../../../theme/constants';
import type { CSSProperties, ReactNode } from 'react';

interface ComponentShowcaseProps {
  /**
   * The bundle the editor is currently editing. The showcase mirrors the SAME
   * `activeBundle` the tablist drives, so it always previews the component that
   * bundle paints — never an everything-at-once montage (PRD point 4).
   */
  activeBundle: Bundle;
  /**
   * The editor's local color mode. Part of the re-stagger key only — a mode flip
   * repaints the preview, so the mock replays its enter animation (PRD point 10).
   */
  editorMode: Mode;
  /**
   * A monotonically increasing counter the parent bumps on each Randomize. It
   * joins `activeBundle` + `editorMode` in the mock's remount key so a fresh
   * random palette re-staggers the showcase in — the editor's "Stumble for
   * colors" landing with a flourish (PRD point 12).
   */
  randomizeNonce: number;
  /**
   * The resolved custom palette, scoped to the decorative mock ALONE (mounted on
   * the aria-hidden mock container), so the left Colors card renders in the APP
   * THEME (PRD point 9 inversion).
   */
  contentThemeStyle: CSSProperties;
}

/**
 * The per-child enter stagger, identical in spirit to the links list: each
 * direct piece of the active bundle's mock animates in with `animate-card-enter`
 * and an inline `animationDelay` of `min(index * 60, 240)ms`. It is CSS-driven,
 * so the global prefers-reduced-motion clamp collapses it to the correct end
 * state (the `both` fill mode lands opacity 1 / translateY 0) for free. The
 * stagger replays whenever the parent remounts the mock via its key.
 */
function MockStagger({ children }: { children: ReactNode }) {
  return (
    <>
      {Children.map(children, (child, index) => (
        <div
          className="animate-card-enter"
          style={{ animationDelay: `${Math.min(index * 60, 240)}ms` }}
        >
          {child}
        </div>
      ))}
    </>
  );
}

/**
 * A short, honest sentence per bundle, describing where in the real app that
 * bundle's colors are used. This copy is REAL app UI (it lives OUTSIDE the
 * aria-hidden mock subtree, in the accessibility tree) so it must read as the
 * app's own voice — concise, truthful, no marketing.
 */
export const BUNDLE_EXPLANATIONS: Record<Bundle, string> = {
  base: 'Used for the page itself: the toolbar, search field, and tabs.',
  mount: 'Used for your saved-link cards and settings panels.',
  orbit: 'Used for the top bar and your account menu.',
  alert: 'Used when something breaks, like a link that won’t open.',
  warn: 'Used for the heads-up banners, like read links on their way out.',
  info: 'Used for tips and the occasional helpful nudge.',
  success: 'Used for success toasts, like “Link saved!” and verified badges.',
};

/**
 * The preview's macOS-style window chrome: the frame border, title bar, address
 * pill, and the three traffic lights. Deliberately theme-independent — it frames
 * the themed content like a real app window, so it stays constant across every
 * bundle and mode and is never painted from the custom palette.
 */
const PREVIEW_CHROME = {
  frameBorder: '#424041',
  titleBar: '#2d2a2b',
  pillBorder: '#423e41',
  trafficRed: '#fe5c5f',
  trafficYellow: '#f9c800',
  trafficGreen: '#27c73f',
} as const;

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
      <div className="flex-1 pb-4 bg-[var(--base-bg)]">
        <MockStagger>
          <MockToolbar />
        </MockStagger>
      </div>
    );
  }
  if (bundle === 'mount') {
    return (
      <div className="flex-1 p-4 bg-[var(--base-bg)]">
        <MockStagger>
          <MockLinkCard />
        </MockStagger>
      </div>
    );
  }
  if (bundle === 'orbit') {
    return (
      <div className="relative flex-1 bg-[var(--base-bg)]">
        <MockStagger>
          <MockHeader />
        </MockStagger>
        {/* The open account menu drops from the top-right avatar, overlaying the
            content the way the real dropdown does — inset so it is never
            clipped. The menu is the second staggered piece, so it slides in just
            after the header. */}
        <div className="absolute right-3 top-12 z-10 animate-card-enter [animation-delay:60ms]">
          <MockMenu />
        </div>
        <div className="h-32" />
      </div>
    );
  }
  return (
    <div className="flex-1 p-4 bg-[var(--base-bg)]">
      <MockStagger>
        <MockNotice
          bundle={bundle}
          icon={STATUS_ICONS[bundle]}
          banner={STATUS_COPY[bundle].banner}
          toast={STATUS_COPY[bundle].toast}
        />
      </MockStagger>
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

// Asemic Old Turkic stand-ins for each status notice's banner + toast lines.
// They feed MockNotice's props; MockNotice renders them verbatim (no string
// edit there).
const STATUS_COPY: Record<StatusBundle, { banner: string; toast: string }> =
  MOCK_STATUS_GLYPHS;

/**
 * The right-hand live preview: a named region fronted by an `sr-only` "Live
 * preview" h2 (parity with the left "Colors" region), then a VISIBLE, app-themed
 * sentence describing where the active bundle's colors are used, then the
 * decorative mock of the component that bundle paints.
 *
 * The mock is a PICTURE of the app, not the app: 100% static (no state, no
 * handlers) with zero focusable descendants, wrapped in a single `aria-hidden`
 * container and skipped by the Tab order and the screen-reader cursor. ONLY that
 * container carries the custom palette (`contentThemeStyle`) — so the user
 * previews their colors (including bad contrast, which is the point) while the
 * explanation and heading render in the always-readable app theme.
 *
 * Swapping the bundle/mode swaps the mock SILENTLY: the activated tab already
 * self-voices, so there is no live region and no focus move here (the showcase
 * has no focusable elements to steal focus to).
 *
 * The mock's visible copy is asemic Old Turkic, rendered in a self-hosted
 * webfont scoped to the `.app-mock-asemic` container alone (see index.css +
 * mockGlyphs), and the container carries `cursor-not-allowed` — together they
 * read the preview as decoration that is not meant to be interacted with.
 */
export default function ComponentShowcase({
  activeBundle,
  editorMode,
  randomizeNonce,
  contentThemeStyle,
}: ComponentShowcaseProps) {
  const headingId = useId();

  // The mock's REMOUNT key (§2). Bumping it on a bundle swap, a mode flip, or a
  // Randomize tears down + rebuilds the inner mock, replaying `animate-card-enter`
  // on every piece — the showcase comes alive on each selection (PRD points 10 +
  // 12). It is keyed on the INNER aria-hidden mock ALONE: the section, its
  // sr-only heading, and the explanation stay mounted, so nothing re-announces
  // and no focus can move (the mock has zero focusable descendants).
  const mockKey = `${activeBundle}-${editorMode}-${randomizeNonce}`;

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="sr-only">
        Live preview
      </h2>

      <div
        className="flex flex-col w-full min-h-60 bg-[var(--base-bg)] border shadow-xl rounded-2xl overflow-hidden"
        style={{ borderColor: PREVIEW_CHROME.frameBorder }}
      >
        <div
          className="flex flex-row items-center justify-between w-full h-8 px-3"
          style={{ backgroundColor: PREVIEW_CHROME.titleBar }}
        >
          <div className="flex flex-row items-center gap-0.75 text-xs shadow-xl">
            <i
              className="fa-solid fa-circle"
              style={{ color: PREVIEW_CHROME.trafficRed }}
            ></i>
            <i
              className="fa-solid fa-circle"
              style={{ color: PREVIEW_CHROME.trafficYellow }}
            ></i>
            <i
              className="fa-solid fa-circle"
              style={{ color: PREVIEW_CHROME.trafficGreen }}
            ></i>
          </div>

          <div
            className="flex flex-row items-center h-6 px-12 border shadow-xl rounded-4xl"
            style={{ borderColor: PREVIEW_CHROME.pillBorder }}
          >
            <span className="text-white text-xs">Preview</span>
          </div>

          <div className="flex flex-row items-center gap-0.75 text-xs">
            <i className="fa-solid fa-circle text-transparent"></i>
            <i className="fa-solid fa-circle text-transparent"></i>
            <i className="fa-solid fa-circle text-transparent"></i>
          </div>
        </div>

        <div
          className="relative flex flex-1 flex-col w-full overflow-hidden app-mock-asemic cursor-not-allowed"
          style={contentThemeStyle}
          data-testid="app-mock"
          key={mockKey}
          aria-hidden="true"
        >
          <BundleMock bundle={activeBundle} />
        </div>
      </div>

      <p className="text-[var(--base-alt-text)] text-xs">
        {BUNDLE_EXPLANATIONS[activeBundle]}
      </p>
    </section>
  );
}
