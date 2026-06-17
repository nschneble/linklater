/**
 * Anti-regression coverage for the a11y contract shipped on ApiDocsView's
 * brand-chrome header. Tests are structural — they pin landmarks, heading
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

// ─── Imports after mocks ──────────────────────────────────────────────────────

import ApiDocsView from './ApiDocsView';

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

function renderApiDocs() {
  return render(
    <MemoryRouter initialEntries={['/settings/api']}>
      <Routes>
        <Route path="/settings/api" element={<ApiDocsView />} />
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

  it('exposes a labelled <section> region that the skip link targets', () => {
    renderApiDocs();

    const region = screen.getByRole('region', { name: 'API documentation' });
    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('id', 'api-docs');
  });

  it('renders two nav links with clean accessible names (no arrow leakage)', () => {
    renderApiDocs();

    const backLink = screen.getByRole('link', { name: 'Linklater' });
    expect(backLink).toHaveAttribute('href', '/');

    const tokensLink = screen.getByRole('link', { name: 'Manage tokens' });
    expect(tokensLink).toHaveAttribute('href', '/settings');
  });

  it('passes scrollTo:integrations through router state to /settings', async () => {
    const user = userEvent.setup();
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
    // (SC 2.4.3 — Focus Order).
    const positiveTabindex = container.querySelector(
      '[tabindex]:not([tabindex="0"]):not([tabindex="-1"])',
    );
    expect(positiveTabindex).toBeNull();
  });

  it('sets document.title to "API documentation – Linklater" (SC 2.4.2)', () => {
    renderApiDocs();

    expect(document.title).toBe('API documentation – Linklater');
  });

  it('keeps the aria-labelledby h2 target present (H1)', () => {
    renderApiDocs();

    const heading = screen.getByRole('heading', {
      level: 2,
      name: 'API documentation',
    });
    expect(heading).toHaveAttribute('id', 'api-docs-reference-heading');

    const region = screen.getByRole('region', { name: 'API documentation' });
    expect(region).toHaveAttribute(
      'aria-labelledby',
      'api-docs-reference-heading',
    );
  });

  it('renders the endpoint list inside the labelled api-docs region', async () => {
    fetchOpenApiMock.mockResolvedValue(linksApi);
    renderApiDocs();

    const list = await screen.findByRole('list');
    const section = list.closest('section');
    expect(section).not.toBeNull();
    expect(section).toHaveAttribute('id', 'api-docs');
    expect(section).toHaveAttribute(
      'aria-labelledby',
      'api-docs-reference-heading',
    );
  });
});
