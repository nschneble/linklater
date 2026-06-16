import { useMemo } from 'react';

/**
 * Style overrides concatenated into Scalar's `customCss` so the rules live
 * inside its style scope.
 *
 * REDUCED_MOTION_CSS — collapses every animation/transition inside the embed
 * under `prefers-reduced-motion: reduce`.
 *
 * HIDE_SPEC_TITLE_CSS — hides Scalar's own h1 (the spec's `info.title`), so
 * the brand page banner is the sole visible H1. The selector is the h1
 * rendered by Scalar's `IntroductionLayout` component, which wraps
 * `info.title` in `<SectionHeaderTag level="1">`. That emits
 * `<h1 class="section-header-label">` inside an ancestor with the
 * `.introduction-section` class (verified in `@scalar/api-reference@0.9.46`
 * dist sources). Only the introduction h1 is hidden; operation/section
 * headings (h2, h3, …) elsewhere in the embed remain visible.
 *
 * MODAL_SCROLL_LOCK_CSS — pins the page scroll while Scalar's Test Request
 * modal is open. Scalar's built-in `useScrollLock` (see
 * `@scalar/api-client/dist/v2/features/modal/Modal.vue.script.js`) sets
 * `body.style.overflow = 'hidden'` on open, but on a standards-mode page the
 * scrolling element is `<html>`, not `<body>` — so wheel/arrow/Page Down
 * events still scroll the page underneath the modal (WCAG 2.4.3, 1.4.10).
 * `:has()` makes the lock conditional on Scalar's own `.scalar-client--open`
 * state class (added by `ModalClientContainer`), so the lock auto-releases
 * the instant the modal closes — no JS lifecycle to manage, no risk of a
 * leaked lock after close. The Scalar modal's internal scroll containers
 * are untouched, so modal content scrolls normally.
 */
const REDUCED_MOTION_CSS = `
@media (prefers-reduced-motion: reduce) {
  .scalar-app *,
  .scalar-app *::before,
  .scalar-app *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
`;

const HIDE_SPEC_TITLE_CSS = `
.scalar-app .introduction-section h1.section-header-label {
  display: none;
}
`;

const MODAL_SCROLL_LOCK_CSS = `
html:has(.scalar-container.scalar-client--open) {
  overflow: hidden;
}
`;

interface OperationSortValue {
  method: string;
  path: string;
}

/**
 * Builds the Scalar configuration object.
 *
 * https://scalar.com/products/api-references/configuration#configuration-options
 *
 * Dark mode is on unconditionally since the brand chrome is dark
 * regardless of the user's theme.
 */
export function useScalarConfiguration(openapiUrl: string, token: string) {
  return useMemo(
    () => ({
      url: openapiUrl,
      layout: 'modern' as const,
      hideDarkModeToggle: true,
      darkMode: true,
      hideModels: true,
      customCss:
        REDUCED_MOTION_CSS + HIDE_SPEC_TITLE_CSS + MODAL_SCROLL_LOCK_CSS,
      authentication: {
        preferredSecurityScheme: 'pat',
        securitySchemes: {
          pat: {
            type: 'http' as const,
            scheme: 'bearer' as const,
            token,
          },
        },
      },
      showDeveloperTools: 'never' as const,
      showSidebar: false,
      withDefaultFonts: false,
      agent: { disabled: true },
      documentDownloadType: 'none' as const,
      isLoading: true,
      operationsSorter: (a: OperationSortValue, b: OperationSortValue) => {
        const methodOrder = ['get', 'post', 'put', 'delete'];
        const methodComparison =
          methodOrder.indexOf(a.method) - methodOrder.indexOf(b.method);
        if (methodComparison !== 0) {
          return methodComparison;
        }
        return a.path.localeCompare(b.path);
      },
    }),
    [openapiUrl, token],
  );
}
