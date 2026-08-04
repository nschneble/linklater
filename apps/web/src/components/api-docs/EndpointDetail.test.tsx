import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NormalizedEndpoint } from '../../lib/openapi';

// MethodBadge reads auth to pick paint; stub so detail needs no provider
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

/**
 * An endpoint that populates both sections plus every Request-panel block
 * (parameters, request-body schema, example body, and the always-present cURL).
 */
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
  serverOrigin?: string;
}

function renderDetail(
  endpoint = makeEndpoint(),
  { serverOrigin = '' }: RenderOptions = {},
) {
  return render(
    <MemoryRouter>
      <EndpointDetail endpoint={endpoint} serverOrigin={serverOrigin} />
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

  it('renders exactly two section tabs labelled Request, Response with disjoint panel ids when responses exist', () => {
    renderDetail(fullEndpoint());
    const root = endpointHeadingId('get', '/links/{id}');
    const tablist = screen.getByRole('tablist', { name: 'Endpoint sections' });

    // only the top-level pills are role=tab; Responses tablist is a sibling
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toHaveAccessibleName('Request');
    expect(tabs[1]).toHaveAccessibleName('Response');

    expect(tabs[0]).toHaveAttribute('id', `${root}-tab-request`);
    expect(tabs[0]).toHaveAttribute('aria-controls', `${root}-panel-request`);
    expect(tabs[1]).toHaveAttribute('id', `${root}-tab-response`);
    expect(tabs[1]).toHaveAttribute('aria-controls', `${root}-panel-response`);
  });

  it('sizes the section tablist to its content (natural width) rather than full-width', () => {
    renderDetail(fullEndpoint());
    const tablist = screen.getByRole('tablist', { name: 'Endpoint sections' });
    // parity with the read/unread link tabs: shrink-wraps to pills (w-fit)
    expect(tablist).toHaveClass('w-fit');
    expect(tablist).not.toHaveClass('w-full');
  });

  it('gives the section pills the shared read/unread pill sizing and typography', () => {
    renderDetail(fullEndpoint());
    const tablist = screen.getByRole('tablist', { name: 'Endpoint sections' });
    // same geometry as the link filter tabs: compact type, px-3 py-1.5 pills
    expect(tablist).toHaveClass('text-xs');
    within(tablist)
      .getAllByRole('tab')
      .forEach((tab) => expect(tab).toHaveClass('px-3', 'py-1.5'));
  });

  it('selects Request first and reveals its parameter + request-body tables', () => {
    renderDetail(fullEndpoint());
    expect(screen.getByRole('tab', { name: 'Request' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // both live in the (active) Request panel, so they are queryable
    expect(
      screen.getByRole('table', { name: /parameters/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: /request body/i }),
    ).toBeInTheDocument();
  });

  it('renders a single "Query parameters" table with no column-header row for a query-only endpoint', () => {
    renderDetail(
      makeEndpoint({
        parameters: [
          { name: 'search', location: 'query', required: false },
          { name: 'limit', location: 'query', required: true },
        ],
      }),
    );

    const queryTable = screen.getByRole('table', { name: 'Query parameters' });
    expect(
      screen.queryByRole('table', { name: 'Path parameters' }),
    ).not.toBeInTheDocument();

    // no column-headers: each param is a scope=row header, location in caption
    expect(within(queryTable).queryAllByRole('columnheader')).toHaveLength(0);
    expect(
      within(queryTable).getByRole('rowheader', { name: /^search\?:/ }),
    ).toBeInTheDocument();
    expect(
      within(queryTable).getByRole('rowheader', { name: /^limit:/ }),
    ).toBeInTheDocument();
    expect(within(queryTable).queryByText('query')).not.toBeInTheDocument();
  });

  it('renders a single "Path parameters" table for a path-only endpoint', () => {
    renderDetail(
      makeEndpoint({
        path: '/links/{id}',
        parameters: [{ name: 'id', location: 'path', required: true }],
      }),
    );

    expect(
      screen.getByRole('table', { name: 'Path parameters' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: 'Query parameters' }),
    ).not.toBeInTheDocument();
  });

  it('splits a mixed endpoint into two sibling tables, Query before Path, each single-location', () => {
    renderDetail(
      makeEndpoint({
        path: '/links/{id}',
        parameters: [
          { name: 'id', location: 'path', required: true },
          { name: 'expand', location: 'query', required: false },
        ],
      }),
    );

    const queryTable = screen.getByRole('table', { name: 'Query parameters' });
    const pathTable = screen.getByRole('table', { name: 'Path parameters' });

    // Query renders BEFORE Path in DOM order
    expect(
      queryTable.compareDocumentPosition(pathTable) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // single-location tables; rowheader inlines the type, so match the prefix
    expect(
      within(queryTable).getByRole('rowheader', { name: /^expand\?:/ }),
    ).toBeInTheDocument();
    expect(
      within(queryTable).queryByRole('rowheader', { name: /^id:/ }),
    ).not.toBeInTheDocument();
    expect(
      within(pathTable).getByRole('rowheader', { name: /^id:/ }),
    ).toBeInTheDocument();
    expect(
      within(pathTable).queryByRole('rowheader', { name: /^expand/ }),
    ).not.toBeInTheDocument();
  });

  it('renders no parameter table at all when the endpoint has no parameters', () => {
    renderDetail(makeEndpoint({ parameters: [] }));
    expect(
      screen.queryByRole('table', { name: /parameters/i }),
    ).not.toBeInTheDocument();
  });

  it("omits the empty group's table: an all-query endpoint yields exactly one table", () => {
    // all params are query, so the empty Path group renders no table at all
    renderDetail(
      makeEndpoint({
        parameters: [{ name: 'search', location: 'query', required: false }],
      }),
    );
    const parameterTables = screen
      .getAllByRole('table')
      .filter((table) => /parameters/i.test(table.textContent ?? ''));
    expect(parameterTables).toHaveLength(1);
    expect(parameterTables[0]).toHaveAccessibleName('Query parameters');
  });

  it('marks the required parameter without a ? and the optional one with a ?', () => {
    renderDetail(
      makeEndpoint({
        parameters: [
          { name: 'search', location: 'query', required: false },
          { name: 'limit', location: 'query', required: true },
        ],
      }),
    );

    // required-ness rides on the name: required is bare, optional gets a "?"
    expect(
      screen.getByRole('rowheader', { name: /^limit:/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('rowheader', { name: /^limit\?/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('rowheader', { name: /^search\?:/ }),
    ).toBeInTheDocument();
  });

  it('is always present: a param-less, body-less, response-less endpoint still yields a non-empty tablist and a reachable cURL Copy button', () => {
    // empty-tablist guard: Request anchors, so a minimal endpoint keeps a tab
    renderDetail(makeEndpoint({ parameters: [], responses: [] }));
    const tablist = screen.getByRole('tablist', { name: 'Endpoint sections' });

    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toHaveAccessibleName('Request');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    expect(
      screen.getByRole('button', { name: /copy curl command/i }),
    ).toBeInTheDocument();
  });

  it('renders the cURL example inside the Request panel, never a separate Try It panel', () => {
    renderDetail(fullEndpoint());
    const root = endpointHeadingId('get', '/links/{id}');

    expect(
      screen.queryByRole('tab', { name: 'Try It' }),
    ).not.toBeInTheDocument();

    const requestPanel = screen.getByRole('tabpanel', { name: 'Request' });
    expect(requestPanel).toHaveAttribute('id', `${root}-panel-request`);
    expect(
      within(requestPanel).getByRole('group', {
        name: 'Example request',
      }),
    ).toBeInTheDocument();
    expect(
      within(requestPanel).getByRole('button', {
        name: /copy curl command/i,
      }),
    ).toBeInTheDocument();
  });

  it('gives the two request-panel example blocks distinct accessible names', () => {
    renderDetail(fullEndpoint());
    const requestPanel = screen.getByRole('tabpanel', { name: 'Request' });
    const root = endpointHeadingId('get', '/links/{id}');

    // JSON body + cURL blocks get distinct, non-prefix-colliding group names
    const bodyBlock = within(requestPanel).getByRole('group', {
      name: 'Example request body',
    });
    expect(bodyBlock).toHaveAttribute(
      'aria-labelledby',
      `${root}-request-example`,
    );

    const curlBlock = within(requestPanel).getByRole('group', {
      name: 'Example request',
    });
    expect(curlBlock).toHaveAttribute(
      'aria-labelledby',
      `${root}-request-curl`,
    );
  });

  it('drops the Request panel tab stop, its example body and cURL carrying the focus', () => {
    const { container } = renderDetail(fullEndpoint());
    const root = endpointHeadingId('get', '/links/{id}');

    const example = screen.getByRole('group', { name: 'Example request body' });
    expect(example).toHaveTextContent('"url"');

    // panel owns focusables (cURL Copy, <pre>), so it's never a tab stop
    const requestPanel = container.querySelector(`#${root}-panel-request`)!;
    expect(requestPanel).not.toHaveAttribute('tabindex');
  });

  it('keeps the Request panel off the tab order even for a body-less endpoint (cURL carries the focus)', () => {
    // no body block, but cURL keeps the panel focusable-owning, so no tabIndex
    const { container } = renderDetail(
      makeEndpoint({
        parameters: [{ name: 'limit', location: 'query', required: false }],
      }),
    );
    const root = endpointHeadingId('get', '/links');

    expect(
      screen.queryByRole('group', { name: 'Example request body' }),
    ).not.toBeInTheDocument();

    const requestPanel = container.querySelector(`#${root}-panel-request`)!;
    expect(requestPanel).not.toHaveAttribute('tabindex');
  });

  it('reveals the picked panel and hides the other via [hidden] WITHOUT unmounting it', async () => {
    const user = userEvent.setup();
    const { container } = renderDetail(fullEndpoint());
    const root = endpointHeadingId('get', '/links/{id}');
    const requestPanel = container.querySelector(`#${root}-panel-request`)!;
    const responsePanel = container.querySelector(`#${root}-panel-response`)!;

    // Request is the default selection
    expect(requestPanel).not.toHaveAttribute('hidden');
    expect(responsePanel).toHaveAttribute('hidden');

    await user.click(screen.getByRole('tab', { name: 'Response' }));

    expect(requestPanel).toHaveAttribute('hidden');
    expect(responsePanel).not.toHaveAttribute('hidden');

    // hidden Request panel stays mounted, so hidden:true reaches its subtree
    expect(
      within(requestPanel as HTMLElement).getByRole('group', {
        name: 'Example request',
        hidden: true,
      }),
    ).toBeInTheDocument();
  });

  it('auto-selects a 204-only endpoint\'s single response tab so its "None" fallback shows once Response is opened', async () => {
    const user = userEvent.setup();
    renderDetail(makeEndpoint({ responses: [{ statusCode: '204' }] }));
    // Request is the default anchor, so open Response to see its sub-tablist
    await user.click(screen.getByRole('tab', { name: 'Response' }));
    expect(screen.getByRole('tab', { name: 'Response 204' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('drops the Response tab and keeps only the Request tab when there are no responses', () => {
    // no responses: a single Request tab survives and its panel stays rendered
    renderDetail(makeEndpoint({ responses: [] }));

    expect(
      screen.queryByRole('tab', { name: 'Response' }),
    ).not.toBeInTheDocument();

    const requestTab = screen.getByRole('tab', { name: 'Request' });
    expect(requestTab).toHaveAttribute('aria-selected', 'true');

    const requestPanel = screen.getByRole('tabpanel', { name: 'Request' });
    expect(requestPanel).not.toHaveAttribute('hidden');
    expect(
      within(requestPanel).getByRole('group', {
        name: 'Example request',
      }),
    ).toBeInTheDocument();
  });

  it('resets the section selection to Request when the endpoint is swapped', async () => {
    const user = userEvent.setup();
    // ApiReference keys EndpointDetail by slug, so a swap remounts + resets
    const { rerender } = render(
      <MemoryRouter>
        <EndpointDetail key="a" endpoint={fullEndpoint()} serverOrigin="" />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('tab', { name: 'Response' }));
    expect(screen.getByRole('tab', { name: 'Response' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    rerender(
      <MemoryRouter>
        <EndpointDetail
          key="b"
          endpoint={fullEndpoint({ path: '/links/{id}/tags' })}
          serverOrigin=""
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('tab', { name: 'Request' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('walks the two top-level pills with Arrow keys via automatic activation, wrapping at both ends', async () => {
    const user = userEvent.setup();
    renderDetail(fullEndpoint());
    const sections = screen.getByRole('tablist', { name: 'Endpoint sections' });

    // the nav hook focuses AND clicks each pill, so selection follows focus
    await user.click(within(sections).getByRole('tab', { name: 'Request' }));

    await user.keyboard('{ArrowRight}');
    expect(
      within(sections).getByRole('tab', { name: 'Response' }),
    ).toHaveAttribute('aria-selected', 'true');

    // rightward off the last pill wraps back to the first
    await user.keyboard('{ArrowRight}');
    expect(
      within(sections).getByRole('tab', { name: 'Request' }),
    ).toHaveAttribute('aria-selected', 'true');

    // leftward off the first pill wraps to the last
    await user.keyboard('{ArrowLeft}');
    expect(
      within(sections).getByRole('tab', { name: 'Response' }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  it('isolates the nested Responses tablist: arrowing its status tabs cycles them without moving the outer section', async () => {
    const user = userEvent.setup();
    renderDetail(
      fullEndpoint({
        responses: [{ statusCode: '200' }, { statusCode: '401' }],
      }),
    );
    const sections = screen.getByRole('tablist', { name: 'Endpoint sections' });

    // open Response to mount its "Responses" sub-tablist; scope queries to it
    await user.click(within(sections).getByRole('tab', { name: 'Response' }));
    const responses = screen.getByRole('tablist', { name: 'Responses' });

    // the first status tab is selected on render; focus it and arrow inward
    expect(
      within(responses).getByRole('tab', { name: 'Response 200' }),
    ).toHaveAttribute('aria-selected', 'true');
    await user.click(
      within(responses).getByRole('tab', { name: 'Response 200' }),
    );
    await user.keyboard('{ArrowRight}');

    // the inner arrow cycled the status tabs …
    expect(
      within(responses).getByRole('tab', { name: 'Response 401' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      within(responses).getByRole('tab', { name: 'Response 200' }),
    ).toHaveAttribute('aria-selected', 'false');

    // … and the OUTER section selection never budged off Response.
    expect(
      within(sections).getByRole('tab', { name: 'Response' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      within(sections).getByRole('tab', { name: 'Request' }),
    ).toHaveAttribute('aria-selected', 'false');
  });

  it('isolates the outer pills: arrowing the section pills leaves the nested Responses selection untouched', async () => {
    const user = userEvent.setup();
    renderDetail(
      fullEndpoint({
        responses: [{ statusCode: '200' }, { statusCode: '401' }],
      }),
    );
    const sections = screen.getByRole('tablist', { name: 'Endpoint sections' });

    // move inner selection off default so a stale outer arrow is detectable
    await user.click(within(sections).getByRole('tab', { name: 'Response' }));
    const responses = screen.getByRole('tablist', { name: 'Responses' });
    await user.click(
      within(responses).getByRole('tab', { name: 'Response 401' }),
    );

    // refocus an OUTER pill and arrow across the top-level sections
    await user.click(within(sections).getByRole('tab', { name: 'Response' }));
    await user.keyboard('{ArrowLeft}');
    expect(
      within(sections).getByRole('tab', { name: 'Request' }),
    ).toHaveAttribute('aria-selected', 'true');

    // the (now-hidden but still-mounted) Responses tablist kept its 401 pick
    const hiddenResponses = screen.getByRole('tablist', {
      name: 'Responses',
      hidden: true,
    });
    expect(
      within(hiddenResponses).getByRole('tab', {
        name: 'Response 401',
        hidden: true,
      }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      within(hiddenResponses).getByRole('tab', {
        name: 'Response 200',
        hidden: true,
      }),
    ).toHaveAttribute('aria-selected', 'false');
  });

  it('clamps a stale section index when the Response section drops on a same-key rerender, keeping the Request panel live', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <MemoryRouter>
        <EndpointDetail key="same" endpoint={fullEndpoint()} serverOrigin="" />
      </MemoryRouter>,
    );

    // select Response (index 1); the index goes stale for a response-less one
    await user.click(screen.getByRole('tab', { name: 'Response' }));
    expect(screen.getByRole('tab', { name: 'Response' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // without the Math.min clamp, a stale selectedIndex blanks the detail
    rerender(
      <MemoryRouter>
        <EndpointDetail
          key="same"
          endpoint={makeEndpoint({ responses: [] })}
          serverOrigin=""
        />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole('tab', { name: 'Response' }),
    ).not.toBeInTheDocument();

    // the clamp rescues the stale index, so the Request panel stays visible
    const requestPanel = screen.getByRole('tabpanel', { name: 'Request' });
    expect(requestPanel).not.toHaveAttribute('hidden');
    expect(
      within(requestPanel).getByRole('group', {
        name: 'Example request',
      }),
    ).toBeInTheDocument();
  });
});
