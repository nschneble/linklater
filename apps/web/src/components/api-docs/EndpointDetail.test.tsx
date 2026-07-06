import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
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

/** An endpoint that populates all three sections, so every tab is present. */
function fullEndpoint(
  overrides: Partial<NormalizedEndpoint> = {},
): NormalizedEndpoint {
  return makeEndpoint({
    path: '/links/{id}',
    parameters: [{ name: 'limit', location: 'query', required: false }],
    requestBody: {
      required: true,
      schema: { type: 'object', properties: { url: { type: 'string' } } },
    },
    responses: [{ statusCode: '200', schema: { type: 'object' } }],
    ...overrides,
  });
}

interface RenderOptions {
  loggedIn?: boolean;
  serverOrigin?: string;
  token?: string;
  onStatusMessage?: ReturnType<typeof vi.fn>;
}

function renderDetail(
  endpoint = makeEndpoint(),
  {
    loggedIn = true,
    serverOrigin = '',
    token = '',
    onStatusMessage = vi.fn(),
  }: RenderOptions = {},
) {
  return render(
    <MemoryRouter>
      <EndpointDetail
        endpoint={endpoint}
        loggedIn={loggedIn}
        serverOrigin={serverOrigin}
        token={token}
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

  it('renders three section tabs labelled Request, Response, Try It with disjoint panel ids', () => {
    renderDetail(fullEndpoint());
    const root = endpointHeadingId('get', '/links/{id}');
    const tablist = screen.getByRole('tablist', { name: 'Endpoint sections' });

    // Only the three top-level pills carry role=tab under this tablist – the
    // inner Responses sub-tablist sits in a sibling panel, not inside the bar.
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0]).toHaveAccessibleName('Request');
    expect(tabs[1]).toHaveAccessibleName('Response');
    expect(tabs[2]).toHaveAccessibleName('Try It');

    expect(tabs[0]).toHaveAttribute('id', `${root}-tab-request`);
    expect(tabs[0]).toHaveAttribute('aria-controls', `${root}-panel-request`);
    expect(tabs[1]).toHaveAttribute('id', `${root}-tab-response`);
    expect(tabs[1]).toHaveAttribute('aria-controls', `${root}-panel-response`);
    expect(tabs[2]).toHaveAttribute('id', `${root}-tab-tryit`);
    expect(tabs[2]).toHaveAttribute('aria-controls', `${root}-panel-tryit`);
  });

  it('selects Request first and reveals its parameter + request-body tables', () => {
    renderDetail(fullEndpoint());
    expect(screen.getByRole('tab', { name: 'Request' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // Both live in the (active) Request panel, so they are queryable.
    expect(
      screen.getByRole('table', { name: /parameters/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: /request body/i }),
    ).toBeInTheDocument();
  });

  it('reveals the picked panel and hides the rest via [hidden] WITHOUT unmounting them', async () => {
    const user = userEvent.setup();
    const { container } = renderDetail(fullEndpoint());
    const root = endpointHeadingId('get', '/links/{id}');
    const requestPanel = container.querySelector(`#${root}-panel-request`)!;
    const responsePanel = container.querySelector(`#${root}-panel-response`)!;
    const tryitPanel = container.querySelector(`#${root}-panel-tryit`)!;

    // Request is the default selection.
    expect(requestPanel).not.toHaveAttribute('hidden');
    expect(responsePanel).toHaveAttribute('hidden');
    expect(tryitPanel).toHaveAttribute('hidden');

    await user.click(screen.getByRole('tab', { name: 'Try It' }));

    expect(requestPanel).toHaveAttribute('hidden');
    expect(responsePanel).toHaveAttribute('hidden');
    expect(tryitPanel).not.toHaveAttribute('hidden');

    // The now-hidden Request panel is still mounted (table in the DOM), not
    // torn down – hidden:true reaches into the collapsed subtree.
    expect(
      within(requestPanel as HTMLElement).getByRole('table', {
        name: /parameters/i,
        hidden: true,
      }),
    ).toBeInTheDocument();
  });

  it('auto-selects a 204-only endpoint\'s single response tab so its "No response body" fallback shows', () => {
    renderDetail(makeEndpoint({ responses: [{ statusCode: '204' }] }));
    expect(screen.getByRole('tab', { name: 'Response 204' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText(/No response body\./i)).toBeInTheDocument();
  });

  it('drops the Request tab entirely when there are no parameters and no request body', () => {
    renderDetail(makeEndpoint());
    expect(
      screen.queryByRole('tab', { name: 'Request' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Response' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Try It' })).toBeInTheDocument();
  });

  it('renders a copy-ready cURL example under Try It in both auth states', async () => {
    const user = userEvent.setup();
    renderDetail(makeEndpoint(), { loggedIn: false });
    await user.click(screen.getByRole('tab', { name: 'Try It' }));
    expect(screen.getByText('Example request')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /copy curl command/i }),
    ).toBeInTheDocument();
  });

  it('embeds the try-it-out form under Try It when logged in', async () => {
    const user = userEvent.setup();
    renderDetail(makeEndpoint(), { loggedIn: true });
    await user.click(screen.getByRole('tab', { name: 'Try It' }));
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

  it('keeps typed try-it-out values across a tab round-trip (no redundant re-entry)', async () => {
    const user = userEvent.setup();
    renderDetail(fullEndpoint(), { loggedIn: true, token: 'ltk_test' });

    await user.click(screen.getByRole('tab', { name: 'Try It' }));
    const field = screen.getByRole('textbox', { name: /limit/i });
    await user.type(field, '42');
    expect(field).toHaveValue('42');

    // Leave and return – the Try It panel is hidden, never unmounted.
    await user.click(screen.getByRole('tab', { name: 'Request' }));
    await user.click(screen.getByRole('tab', { name: 'Try It' }));

    expect(screen.getByRole('textbox', { name: /limit/i })).toHaveValue('42');
  });

  it('reports the form status upward instead of rendering an inline announcer', async () => {
    const user = userEvent.setup();
    const onStatusMessage = vi.fn();
    renderDetail(makeEndpoint(), { loggedIn: true, onStatusMessage });
    await user.click(screen.getByRole('tab', { name: 'Try It' }));
    // With the status hoisted, the only status node in the Try It panel is
    // CurlExample's (empty) copy-confirmation region – never a form announcer.
    screen
      .queryAllByRole('status')
      .forEach((node) => expect(node).toBeEmptyDOMElement());
    expect(onStatusMessage).toHaveBeenCalled();
  });

  it('resets the section selection to Request when the endpoint is swapped', async () => {
    const user = userEvent.setup();
    // The parent (ApiReference) keys EndpointDetail by slug, so an endpoint
    // swap remounts it; a fresh mount re-initializes the selection to Request.
    const props = {
      loggedIn: true,
      serverOrigin: '',
      token: '',
      tokenLoading: false,
      tokenError: null,
      onStatusMessage: vi.fn(),
    };
    const { rerender } = render(
      <MemoryRouter>
        <EndpointDetail key="a" endpoint={fullEndpoint()} {...props} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: 'Try It' }));
    expect(screen.getByRole('tab', { name: 'Try It' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    rerender(
      <MemoryRouter>
        <EndpointDetail
          key="b"
          endpoint={fullEndpoint({ path: '/links/{id}/tags' })}
          {...props}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('tab', { name: 'Request' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });
});
