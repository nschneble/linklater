import MockBanner from './MockBanner';
import MockHeader from './MockHeader';
import MockLinkCard from './MockLinkCard';
import MockToast from './MockToast';
import MockToolbar from './MockToolbar';
import { MOCK_STATUS_GLYPHS } from './mockGlyphs';
import { useId } from 'react';
import type { Bundle } from './useThemeOverrides';
import type { Mode } from '../../../theme/constants';
import type { CSSProperties } from 'react';

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
   * joins `editorMode` in the mock's remount key so a fresh random palette
   * re-staggers the showcase in — the editor's "Stumble for colors" landing with
   * a flourish (PRD point 12).
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
 * A short, honest sentence per bundle, describing where in the real app that
 * bundle's colors are used. This copy is REAL app UI (it lives OUTSIDE the
 * aria-hidden mock subtree, in the accessibility tree) so it must read as the
 * app's own voice — concise, truthful, no marketing.
 */
export const BUNDLE_EXPLANATIONS: Record<Bundle, string> = {
  base: 'Page defaults. Covers elements like the page title, search input, and navigation buttons.',
  mount: 'Used for raised components like cards, panels, and sections.',
  orbit: 'Used for the page header, user menu, and submenus.',
  alert:
    'Used for danger and failure toast notifications and banners. These typically indicate something has gone dreadfully wrong.',
  warn: 'Used for warning toast notifications, banners, and badges. These typically indicate an action is required.',
  info: 'Used for informational toast notifications, banners, and badges.',
  success: 'Used for successful toast notifications and banners.',
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
  const icon = STATUS_ICONS[bundle];
  const banner = STATUS_COPY[bundle].banner;
  const toast = STATUS_COPY[bundle].toast;

  return (
    <div className="relative flex-1 pb-3 bg-[var(--base-bg)]">
      <MockBanner bundle={bundle} icon={icon} text={banner} />
      <MockHeader muted={bundle !== 'orbit'} />
      <MockToolbar muted={bundle !== 'base'} />
      <MockLinkCard muted={bundle !== 'mount'} />
      <div className="h-[34px]" />
      <MockToast bundle={bundle} icon={icon} text={toast} />
    </div>
  );
}

const STATUS_ICONS: Record<Bundle, string> = {
  base: 'fa-solid fa-cat',
  mount: 'fa-solid fa-cat',
  orbit: 'fa-solid fa-cat',
  warn: 'fa-solid fa-triangle-exclamation',
  info: 'fa-solid fa-circle-info',
  alert: 'fa-solid fa-circle-xmark',
  success: 'fa-solid fa-circle-check',
};

// Asemic Old Turkic stand-ins for each status notice's banner + toast lines.
// They feed MockNotice's props; MockNotice renders them verbatim (no string
// edit there).
const STATUS_COPY: Record<Bundle, { banner: string; toast: string }> =
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

  // The mock's REMOUNT key (§2). A mode flip or a Randomize bumps it to tear
  // down + rebuild the inner mock, replaying `animate-card-enter` on every piece
  // (PRD points 10 + 12). A bundle swap is DELIBERATELY absent: it reconciles the
  // nodes in place so `data-muted` flips on stable DOM and the sub-mocks crossfade
  // grayscale→color instead of hard-cutting. It is keyed on the INNER aria-hidden
  // mock ALONE: the section, its sr-only heading, and the explanation stay
  // mounted, so nothing re-announces and no focus can move.
  const mockKey = `${editorMode}-${randomizeNonce}`;

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="sr-only">
        Live preview
      </h2>

      <div
        className="flex flex-col w-full min-h-90 bg-[var(--base-bg)] border rounded-2xl shadow-xl overflow-hidden"
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
            className="flex flex-row items-center h-6 px-12 border rounded-4xl shadow-xl"
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
          className="group relative flex flex-1 flex-col w-full overflow-hidden app-mock-asemic"
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
