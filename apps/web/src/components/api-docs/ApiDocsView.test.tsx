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
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedApi } from '../../lib/openapi';
import type { User } from '../../auth/AuthContext/types';

// ─── Module mocks (must precede import of ApiDocsView) ────────────────────────

const fetchOpenApiMock = vi.fn<() => Promise<NormalizedApi>>();

// Stub the spec fetch so the endpoint list renders deterministically. The real
// `parseOpenApi`/`resolveOpenApiUrl` stay intact (only `fetchOpenApi` swapped).
vi.mock('../../lib/openapi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/openapi')>();
  return {
    ...actual,
    fetchOpenApi: () => fetchOpenApiMock(),
  };
});

// The "try it out" forms each consume the API-docs token; stub the hook so
// these header-contract tests need neither the auth provider nor the network.
vi.mock('./useApiDocsToken', () => ({
  useApiDocsToken: () => ({ token: '', loading: false, error: null }),
}));

// Auth drives the visual branch: logged out → brand chrome, logged
// in → the active theme. Mock it so tests can pick either branch.
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
  // Each test starts from a known title so the SC 2.4.2 assertion is honest.
  document.title = 'unset';
  window.sessionStorage.clear();
  // The header a11y contract is auth-agnostic; default to the brand (logged-out)
  // branch. The dedicated "visual branch" describe overrides per case.
  mockAuth(null);
  fetchOpenApiMock.mockReset();
  // Default to a never-settling fetch so the structural chrome tests assert
  // against the loading state and never trigger a post-test state update (act
  // warning). The one test that needs the rendered list opts into `linksApi`.
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

    // Cheap structural check: the header element contains the nav, and the
    // nav appears before the h1's parent within the header.
    const header = container.querySelector('header');
    expect(header).toBeTruthy();
    expect(header).toContainElement(nav);
    expect(header).toContainElement(h1);

    const order = nav.compareDocumentPosition(h1);
    // Node.DOCUMENT_POSITION_FOLLOWING = 4 means h1 comes after nav.
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

    // Any tabindex other than "0" or "-1" is a positive-tabindex anti-pattern
    // (SC 2.4.3 – Focus Order).
    const positiveTabindex = container.querySelector(
      '[tabindex]:not([tabindex="0"]):not([tabindex="-1"])',
    );
    expect(positiveTabindex).toBeNull();
  });

  it('sets document.title to "API documentation – Linklater" (SC 2.4.2)', () => {
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

/*
 * The dual visual branch, verified via class-string + inline-style
 * assertions on the page wrapper (no dev server, per
 * [[feedback-token-plumbing-verify]]). The wrapper is the first <div> the
 * component renders; we read it from the rendered container.
 */
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
    it('pins bg-hit-man and dark color-scheme on the wrapper', () => {
      mockAuth(null);
      const { container } = renderApiDocs();
      const node = wrapper(container);
      expect(node.className).toContain('bg-hit-man');
      expect(node.className).toContain('[color-scheme:dark]');
    });

    it('pins the brand bundle-token literals inline on the wrapper', () => {
      mockAuth(null);
      const { container } = renderApiDocs();
      const node = wrapper(container);
      // Brand pins resolve the token-driven children to the marketing palette.
      expect(node.style.getPropertyValue('--base-bg')).toBe('#0a0812');
      expect(node.style.getPropertyValue('--focus-ring')).toBe('#eeeede');
      expect(node.style.getPropertyValue('--mount-text')).toBe('#eeeede');
      expect(node.style.getPropertyValue('--mount-border')).toBe('#7d6ec0');
      expect(node.style.getPropertyValue('--alert-text')).toBe('#fca5a5');
      expect(node.style.getPropertyValue('--success-text')).toBe('#86efac');
    });

    it('keeps the marketing gradient h1', () => {
      mockAuth(null);
      renderApiDocs();
      const heading = screen.getByRole('heading', {
        level: 1,
        name: 'Linklater API',
      });
      expect(heading.className).toContain('from-dazed');
      expect(heading.className).toContain('to-sunrise');
    });
  });

  describe('logged in → active theme', () => {
    it('drops bg-hit-man and the inline brand token pins', () => {
      mockAuth(SOME_USER);
      const { container } = renderApiDocs();
      const node = wrapper(container);
      expect(node.className).not.toContain('bg-hit-man');
      // No inline brand pins – the <html> theme cascade supplies every slot.
      expect(node.style.getPropertyValue('--base-bg')).toBe('');
      expect(node.style.getPropertyValue('--focus-ring')).toBe('');
      expect(node.style.getPropertyValue('--mount-text')).toBe('');
    });

    it('leaves color-scheme mode-driven (no pinned dark) on the wrapper', () => {
      mockAuth(SOME_USER);
      const { container } = renderApiDocs();
      const node = wrapper(container);
      expect(node.className).not.toContain('[color-scheme:dark]');
    });

    it('renders a solid base-text h1 (no marketing gradient)', () => {
      mockAuth(SOME_USER);
      renderApiDocs();
      const heading = screen.getByRole('heading', {
        level: 1,
        name: 'Linklater API',
      });
      expect(heading.className).toContain('text-[var(--base-text)]');
      expect(heading.className).not.toContain('from-dazed');
    });
  });
});
