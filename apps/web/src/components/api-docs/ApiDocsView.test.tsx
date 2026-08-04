/**
 * Anti-regression coverage for the a11y contract shipped on ApiDocsView's
 * brand-chrome header. Tests are structural – they pin landmarks, heading
 * order, skip-link reachability, link accessible names, document title.
 *
 * Per `feedback-deferred-aria-live-test-shape.md`, structural arguments cover
 * most of this without DOM-poking; we use jsdom for the deferred bits
 * (document.title, link-state round-trip via MemoryRouter).
 *
 * The OpenAPI fetch is mocked to a representative multi-endpoint `/links`
 * fixture so the endpoint list renders without a network round-trip and the
 * labelled-region assertion can confirm the list lives inside the correct
 * accessible region.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedApi } from '../../lib/openapi';
import type { User } from '../../auth/AuthContext/types';

// ─── Module mocks (must precede import of ApiDocsView) ────────────────────────

const fetchOpenApiMock = vi.fn<() => Promise<NormalizedApi>>();

// stub the spec fetch; the real parseOpenApi/resolveOpenApiUrl stay intact
vi.mock('../../lib/openapi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/openapi')>();
  return {
    ...actual,
    fetchOpenApi: () => fetchOpenApiMock(),
  };
});

// auth drives the visual branch: logged out → brand, logged in → theme
vi.mock('../../auth/AuthContext', () => ({
  useAuth: vi.fn(),
}));

// ─── Imports after mocks ──────────────────────────────────────────────────────

import ApiDocsView from './ApiDocsView';
import { useAuth } from '../../auth/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Stub route that surfaces the router state as JSON for assertions. */
function LocationStateProbe() {
  const location = useLocation();
  return (
    <div data-testid="location-state-probe">
      {JSON.stringify(location.state)}
    </div>
  );
}

/** Minimal logged-in user – only its presence (non-null) drives the branch. */
const SOME_USER = { userId: 'user-1' } as User;

/** Point `useAuth` at the logged-out (brand) or logged-in (themed) branch. */
function mockAuth(user: User | null) {
  vi.mocked(useAuth).mockReturnValue({
    user,
  } as ReturnType<typeof useAuth>);
}

function renderApiDocs() {
  return render(
    <MemoryRouter initialEntries={['/docs']}>
      <Routes>
        <Route path="/docs" element={<ApiDocsView />} />
        <Route path="/" element={<div>home stub</div>} />
        <Route path="/settings" element={<LocationStateProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

/** Representative multi-endpoint fixture so list + region assertions hold. */
const linksApi: NormalizedApi = {
  info: { title: 'Linklater API', version: '1.0.0' },
  serverOrigin: '',
  endpoints: [
    {
      method: 'get',
      path: '/links',
      summary: 'List links',
      parameters: [],
      responses: [
        {
          statusCode: '200',
          schema: { type: 'object', properties: { id: { type: 'string' } } },
        },
      ],
    },
    {
      method: 'post',
      path: '/links',
      summary: 'Create a link',
      parameters: [],
      requestBody: {
        required: true,
        schema: {
          type: 'object',
          required: ['url'],
          properties: { url: { type: 'string' } },
        },
      },
      responses: [
        {
          statusCode: '201',
          schema: { type: 'object', properties: { id: { type: 'string' } } },
        },
      ],
    },
  ],
};

beforeEach(() => {
  // start from a known title so the SC 2.4.2 assertion is honest
  document.title = 'unset';
  window.sessionStorage.clear();
  // header a11y contract is auth-agnostic; default to the logged-out branch
  mockAuth(null);
  fetchOpenApiMock.mockReset();
  // never-settling fetch keeps tests in the loading state (no act warning)
  fetchOpenApiMock.mockReturnValue(new Promise(() => {}));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ApiDocsView a11y contract', () => {
  it('renders exactly one h1, "Linklater API"', () => {
    renderApiDocs();

    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent('Linklater API');
  });

  it('exposes the back/forward nav as a single labelled landmark', () => {
    renderApiDocs();

    const nav = screen.getByRole('navigation', { name: 'API docs' });
    expect(nav).toBeInTheDocument();
    expect(nav.tagName).toBe('NAV');
  });

  it('places the nav landmark before the h1 in DOM order (SC 2.4.3)', () => {
    const { container } = renderApiDocs();

    const nav = screen.getByRole('navigation', { name: 'API docs' });
    const h1 = screen.getByRole('heading', { level: 1, name: 'Linklater API' });

    // structural check: header contains the nav, before the h1
    const header = container.querySelector('header');
    expect(header).toBeTruthy();
    expect(header).toContainElement(nav);
    expect(header).toContainElement(h1);

    const order = nav.compareDocumentPosition(h1);
    // Node.DOCUMENT_POSITION_FOLLOWING = 4 means h1 comes after nav
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('places the skip link as the first focusable element', () => {
    const { container } = renderApiDocs();

    const focusables = container.querySelectorAll('a, button');
    expect(focusables.length).toBeGreaterThan(0);
    expect(focusables[0]).toHaveTextContent('Skip to API documentation');
    expect(focusables[0]).toHaveAttribute('href', '#api-docs');
  });

  it('exposes the labelled <main> landmark that the skip link targets', () => {
    renderApiDocs();

    const main = screen.getByRole('main', { name: 'API documentation' });
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('id', 'api-docs');
  });

  it('makes the skip-link target <main> focusable so activating it lands focus (SC 2.4.1)', () => {
    renderApiDocs();

    const skipLink = screen.getByRole('link', {
      name: 'Skip to API documentation',
    });
    const main = screen.getByRole('main', { name: 'API documentation' });

    // the skip link targets the main landmark by fragment id
    expect(skipLink).toHaveAttribute('href', `#${main.id}`);
    // tabindex=-1 makes <main> focusable; without it the skip link strands focus
    expect(main).toHaveAttribute('tabindex', '-1');
    main.focus();
    expect(main).toHaveFocus();
  });

  it('shows only the back link when logged out (no token management)', () => {
    mockAuth(null);
    renderApiDocs();

    const backLink = screen.getByRole('link', { name: 'Linklater' });
    expect(backLink).toHaveAttribute('href', '/');
    expect(
      screen.queryByRole('link', { name: 'Manage tokens' }),
    ).not.toBeInTheDocument();
  });

  it('adds the "Manage tokens" link with a clean name when logged in', () => {
    mockAuth(SOME_USER);
    renderApiDocs();

    const backLink = screen.getByRole('link', { name: 'Linklater' });
    expect(backLink).toHaveAttribute('href', '/');

    const tokensLink = screen.getByRole('link', { name: 'Manage tokens' });
    expect(tokensLink).toHaveAttribute('href', '/settings');
  });

  it('passes scrollTo:integrations through router state to /settings', async () => {
    const user = userEvent.setup();
    mockAuth(SOME_USER);
    renderApiDocs();

    const tokensLink = screen.getByRole('link', { name: 'Manage tokens' });
    await user.click(tokensLink);

    const probe = await screen.findByTestId('location-state-probe');
    expect(probe).toHaveTextContent(
      JSON.stringify({ scrollTo: 'integrations' }),
    );
  });

  it('has no positive tabindex anywhere in the rendered tree', () => {
    const { container } = renderApiDocs();

    // any tabindex other than "0"/"-1" is an anti-pattern (SC 2.4.3 Focus Order)
    const positiveTabindex = container.querySelector(
      '[tabindex]:not([tabindex="0"]):not([tabindex="-1"])',
    );
    expect(positiveTabindex).toBeNull();
  });

  it('sets document.title to "Linklater – API documentation" (SC 2.4.2)', () => {
    renderApiDocs();

    expect(document.title).toBe('Linklater – API documentation');
  });

  it('keeps the aria-labelledby h2 target present (H1)', () => {
    renderApiDocs();

    const heading = screen.getByRole('heading', {
      level: 2,
      name: 'API documentation',
    });
    expect(heading).toHaveAttribute('id', 'api-docs-heading');

    const main = screen.getByRole('main', { name: 'API documentation' });
    expect(main).toHaveAttribute('aria-labelledby', 'api-docs-heading');
  });

  it('renders the endpoint nav inside the labelled api-docs main', async () => {
    fetchOpenApiMock.mockResolvedValue(linksApi);
    renderApiDocs();

    const nav = await screen.findByRole('navigation', {
      name: 'API endpoints',
    });
    const main = nav.closest('main');
    expect(main).not.toBeNull();
    expect(main).toHaveAttribute('id', 'api-docs');
    expect(main).toHaveAttribute('aria-labelledby', 'api-docs-heading');
  });
});

// checks the dual visual branch via class-string + inline-style on the wrapper
describe('ApiDocsView visual branch', () => {
  /** The page wrapper is the first element rendered inside the router. */
  function wrapper(container: HTMLElement): HTMLElement {
    const node = container.querySelector('div.min-h-screen');
    if (node === null) {
      throw new Error('Could not find the page wrapper');
    }
    return node as HTMLElement;
  }

  describe('logged out → brand chrome', () => {
    it('gates bg-hit-man and dark color-scheme behind the active branding attr', () => {
      mockAuth(null);
      const { container } = renderApiDocs();
      const node = wrapper(container);
      // the paint is auth-invariant in the class string; the data-theme attr
      // (set when logged out) is what activates the gated brand surface
      expect(node.className).toContain("data-[theme='branding']:bg-hit-man");
      expect(node.className).toContain(
        "data-[theme='branding']:[color-scheme:dark]",
      );
      expect(node.getAttribute('data-theme')).toBe('branding');
    });

    it('activates the off-book branding theme cascade on the wrapper', () => {
      mockAuth(null);
      const { container } = renderApiDocs();
      const node = wrapper(container);
      // wrapper shadows <html data-theme>, so children take the branding.css cascade
      expect(node.getAttribute('data-theme')).toBe('branding');
      expect(node.style.getPropertyValue('--base-bg')).toBe('');
      expect(node.style.getPropertyValue('--mount-border')).toBe('');
    });

    it('keeps the marketing gradient h1 gated to the branding group', () => {
      mockAuth(null);
      renderApiDocs();
      const heading = screen.getByRole('heading', {
        level: 1,
        name: 'Linklater API',
      });
      expect(heading.className).toContain(
        "group-data-[theme='branding']/document:from-[var(--base-text)]",
      );
      expect(heading.className).toContain(
        "group-data-[theme='branding']/document:to-[var(--base-highlight)]",
      );
    });
  });

  describe('logged in → active theme', () => {
    it('leaves the gated bg-hit-man inactive without the branding attr', () => {
      mockAuth(SOME_USER);
      const { container } = renderApiDocs();
      const node = wrapper(container);
      // the gated form rides along in the class string but paints nothing;
      // the missing data-theme attr is the real proof of the logged-in branch
      expect(node.className).toContain("data-[theme='branding']:bg-hit-man");
      expect(node.className).not.toMatch(/(^|\s)bg-hit-man(\s|$)/);
      // no data-theme override; the <html> active-theme cascade supplies every slot
      expect(node.getAttribute('data-theme')).toBeNull();
      expect(node.style.getPropertyValue('--base-bg')).toBe('');
    });

    it('leaves color-scheme mode-driven (no ungated dark) on the wrapper', () => {
      mockAuth(SOME_USER);
      const { container } = renderApiDocs();
      const node = wrapper(container);
      expect(node.className).not.toMatch(/(^|\s)\[color-scheme:dark\]/);
      expect(node.getAttribute('data-theme')).toBeNull();
    });

    it('renders a solid base-text h1 (no ungated marketing gradient)', () => {
      mockAuth(SOME_USER);
      renderApiDocs();
      const heading = screen.getByRole('heading', {
        level: 1,
        name: 'Linklater API',
      });
      // the solid title is the unconditional base-text; the gradient is gated
      // behind the branding group, absent when logged in
      expect(heading.className).toContain('text-[var(--base-text)]');
      expect(heading.className).not.toMatch(
        /(^|\s)from-\[var\(--base-text\)\]/,
      );
    });
  });
});

// guards the token migration: skip-link + gradient h1 must not regress to the
// old hardcoded white/hex chrome or silently lose the forced-colors resets
describe('ApiDocsView token chrome', () => {
  it('drives the skip link off theme tokens, not hardcoded brand hex', () => {
    renderApiDocs();
    const skipLink = screen.getByRole('link', {
      name: 'Skip to API documentation',
    });
    const className = skipLink.className;

    expect(className).toContain('focus:bg-[var(--base-highlight)]');
    expect(className).toContain('focus:text-[var(--base-highlight-fg)]');
    expect(className).toContain('focus:outline-[var(--focus-ring)]');
    expect(className).toContain('focus:outline-offset-2');

    expect(className).not.toContain('focus:bg-white');
    expect(className).not.toContain('#14103a');
    expect(className).not.toContain('focus:ring-white');
  });

  it('keeps all four forced-colors resets on the gradient h1 (HCM)', () => {
    renderApiDocs();
    const heading = screen.getByRole('heading', {
      level: 1,
      name: 'Linklater API',
    });
    const className = heading.className;

    expect(className).toContain('forced-colors:bg-none');
    expect(className).toContain('forced-colors:bg-clip-border');
    expect(className).toContain(
      'forced-colors:[-webkit-background-clip:border-box]',
    );
    expect(className).toContain('forced-colors:text-[CanvasText]');
  });
});
