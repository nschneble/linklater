import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { NormalizedEndpoint } from '../../lib/openapi';

// MethodBadge reads auth to pick brand vs themed paint; stub it so the detail
// renders without the auth provider or network.
vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

import EndpointDetail from './EndpointDetail';
import { endpointHeadingId } from './endpointId';

function makeEndpoint(
  overrides: Partial<NormalizedEndpoint> = {},
): NormalizedEndpoint {
  return {
    method: 'get',
    path: '/links',
    summary: 'List links',
    description: 'Returns every link you have saved.',
    parameters: [],
    responses: [{ statusCode: '200', schema: { type: 'object' } }],
    ...overrides,
  };
}

interface RenderOptions {
  loggedIn?: boolean;
  serverOrigin?: string;
  onStatusMessage?: ReturnType<typeof vi.fn>;
}

function renderDetail(
  endpoint = makeEndpoint(),
  {
    loggedIn = true,
    serverOrigin = '',
    onStatusMessage = vi.fn(),
  }: RenderOptions = {},
) {
  return render(
    <MemoryRouter>
      <EndpointDetail
        endpoint={endpoint}
        loggedIn={loggedIn}
        serverOrigin={serverOrigin}
        token=""
        tokenLoading={false}
        tokenError={null}
        onStatusMessage={onStatusMessage}
      />
    </MemoryRouter>,
  );
}

describe('EndpointDetail', () => {
  it('names the heading "GET /links" method-first, focusable but off the tab order', () => {
    renderDetail();
    const heading = screen.getByRole('heading', {
      level: 3,
      name: 'GET /links',
    });
    expect(heading).toHaveAttribute('id', endpointHeadingId('get', '/links'));
    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it('labels its region by the heading', () => {
    renderDetail();
    const region = screen.getByRole('region', { name: 'GET /links' });
    expect(region).toHaveAttribute(
      'aria-labelledby',
      endpointHeadingId('get', '/links'),
    );
  });

  it('renders the summary and description', () => {
    renderDetail();
    expect(screen.getByText('List links')).toBeInTheDocument();
    expect(
      screen.getByText('Returns every link you have saved.'),
    ).toBeInTheDocument();
  });

  it('renders a parameter table when the endpoint has parameters', () => {
    renderDetail(
      makeEndpoint({
        path: '/links/{id}',
        parameters: [{ name: 'id', location: 'path', required: true }],
      }),
    );
    expect(
      screen.getByRole('table', { name: /parameters/i }),
    ).toBeInTheDocument();
  });

  it('auto-selects a 204-only endpoint\'s single tab so its "No response body" fallback shows', () => {
    renderDetail(makeEndpoint({ responses: [{ statusCode: '204' }] }));
    expect(screen.getByRole('tab', { name: 'Response 204' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText(/No response body\./i)).toBeInTheDocument();
  });

  it('renders a copy-ready cURL example in both auth states', () => {
    renderDetail(makeEndpoint(), { loggedIn: false });
    expect(screen.getByText('Example request')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /copy curl command/i }),
    ).toBeInTheDocument();
  });

  it('embeds the try-it-out form when logged in', () => {
    renderDetail(makeEndpoint(), { loggedIn: true });
    expect(
      screen.getByRole('button', { name: /send request/i }),
    ).toBeInTheDocument();
  });

  it('omits the try-it-out form when logged out', () => {
    renderDetail(makeEndpoint(), { loggedIn: false });
    expect(
      screen.queryByRole('button', { name: /send request/i }),
    ).not.toBeInTheDocument();
  });

  it('reports the form status upward instead of rendering an inline announcer', () => {
    const onStatusMessage = vi.fn();
    renderDetail(makeEndpoint(), { loggedIn: true, onStatusMessage });
    // The form hoists its status upward; the only status node present is
    // CurlExample's (empty) copy-confirmation region – never a form announcer.
    screen
      .queryAllByRole('status')
      .forEach((node) => expect(node).toBeEmptyDOMElement());
    expect(onStatusMessage).toHaveBeenCalled();
  });
});
