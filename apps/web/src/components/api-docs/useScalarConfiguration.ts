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

/**
 * Builds the memoized configuration object passed to `<ApiReferenceReact>`.
 *
 * Memoization keeps Scalar from re-mounting on unrelated renders (e.g. a
 * parent component re-rendering without changing `openapiUrl` or `token`).
 * A new object is returned — and Scalar sees a changed prop — whenever
 * `openapiUrl` or `token` changes (including each keystroke in
 * `BrandTokenInput`).
 *
 * Dark mode is forced on unconditionally: the brand chrome is dark
 * regardless of the user's theme.
 */
export function useScalarConfiguration(openapiUrl: string, token: string) {
  return useMemo(
    () => ({
      url: openapiUrl,
      layout: 'modern' as const,
      hideDarkModeToggle: true,
      darkMode: true,
      hideModels: false,
      customCss: REDUCED_MOTION_CSS + HIDE_SPEC_TITLE_CSS,
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
    }),
    [openapiUrl, token],
  );
}
