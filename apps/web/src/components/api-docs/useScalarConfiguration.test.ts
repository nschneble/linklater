import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useScalarConfiguration } from './useScalarConfiguration';

/**
 * Anti-regression coverage for the Scalar configuration builder. Asserts:
 *
 *   1. All four `customCss` rule families are concatenated into the string —
 *      reduced-motion guard, spec-title hide, modal scroll-lock, brand CSS.
 *      Per `feedback-token-plumbing-verify.md`, this is a pure class-string
 *      assertion; no dev-server, no DOM paint.
 *   2. Config shape essentials that downstream consumers (Scalar embed +
 *      `ApiDocsView`) rely on: dark mode pinned on, sidebar off, the PAT
 *      token round-trips into `authentication.securitySchemes.pat.token`.
 */
describe('useScalarConfiguration', () => {
  const OPENAPI_URL = 'https://example.test/openapi.json';
  const TOKEN = 'ltk_test_token';

  it('concatenates all four customCss rule families into the output', () => {
    const { result } = renderHook(() =>
      useScalarConfiguration(OPENAPI_URL, TOKEN),
    );

    const customCss = result.current.customCss;
    expect(typeof customCss).toBe('string');
    expect(customCss.length).toBeGreaterThan(0);

    // Reduced-motion guard — the embed must collapse animations under
    // `prefers-reduced-motion: reduce`.
    expect(customCss).toContain('@media (prefers-reduced-motion: reduce)');

    // Spec-title hide — keeps the brand page banner as the sole visible H1.
    expect(customCss).toContain(
      '.introduction-section h1.section-header-label',
    );

    // Modal scroll-lock — pins page scroll while Scalar's Test Request
    // modal is open (standards-mode pages scroll <html>, not <body>).
    expect(customCss).toContain(
      'html:has(.scalar-container.scalar-client--open)',
    );

    // Brand CSS marker — the dark-mode selector that scopes brand custom
    // properties into Scalar's `.dark-mode` cascade.
    expect(customCss).toContain('.scalar-app .dark-mode');
    expect(customCss).toContain('--scalar-color-1');
  });

  it('pins dark mode on and hides the sidebar', () => {
    const { result } = renderHook(() =>
      useScalarConfiguration(OPENAPI_URL, TOKEN),
    );

    expect(result.current.darkMode).toBe(true);
    expect(result.current.hideDarkModeToggle).toBe(true);
    expect(result.current.showSidebar).toBe(false);
  });

  it('round-trips the openapi URL and PAT token into the configuration', () => {
    const { result } = renderHook(() =>
      useScalarConfiguration(OPENAPI_URL, TOKEN),
    );

    expect(result.current.url).toBe(OPENAPI_URL);
    expect(result.current.authentication.securitySchemes.pat).toMatchObject({
      type: 'http',
      scheme: 'bearer',
      token: TOKEN,
    });
    expect(result.current.authentication.preferredSecurityScheme).toBe('pat');
  });

  it('passes an empty token through without throwing', () => {
    const { result } = renderHook(() =>
      useScalarConfiguration(OPENAPI_URL, ''),
    );

    expect(result.current.authentication.securitySchemes.pat.token).toBe('');
  });
});
