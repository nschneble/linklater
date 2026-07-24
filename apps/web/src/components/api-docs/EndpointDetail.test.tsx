import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
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

    // Only the two top-level pills carry role=tab under this tablist – the
    // inner Responses sub-tablist sits in a sibling panel, not inside the bar.
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
    // Parity with the read/unread link tabs: the bar shrink-wraps to its pills
    // (w-fit) instead of stretching across the card.
    expect(tablist).toHaveClass('w-fit');
    expect(tablist).not.toHaveClass('w-full');
  });

  it('gives the section pills the shared read/unread pill sizing and typography', () => {
    renderDetail(fullEndpoint());
    const tablist = screen.getByRole('tablist', { name: 'Endpoint sections' });
    // Compact type on the bar; px-3 py-1.5 padding on every pill – the same
    // geometry the link filter tabs use.
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
    // Both live in the (active) Request panel, so they are queryable.
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

    // The column-header row is gone: each parameter is a lone scope=row header,
    // and the caption carries the location instead of a per-row "In" cell.
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

    // Query renders BEFORE Path in DOM order.
    expect(
      queryTable.compareDocumentPosition(pathTable) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Each table holds ONLY its own location's parameter (single-location). The
    // rowheader name inlines the type, so match on the name prefix.
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
    // Every parameter is query, so the Path group is empty and its table must
    // be absent – never a captioned "Path parameters" table with no rows.
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

    // Required-ness rides on the parameter name: required is bare, optional
    // gains a trailing "?" (parity with the schema tables).
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
    // The empty-tablist regression guard: Request is the anchor, so even the
    // most minimal endpoint keeps one focusable tab and its cURL content.
    renderDetail(makeEndpoint({ parameters: [], responses: [] }));
    const tablist = screen.getByRole('tablist', { name: 'Endpoint sections' });

    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toHaveAccessibleName('Request');
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');

    // The panel is non-empty and its Copy button is reachable.
    expect(
      screen.getByRole('button', { name: /copy curl command/i }),
    ).toBeInTheDocument();
  });

  it('renders the cURL example inside the Request panel, never a separate Try It panel', () => {
    renderDetail(fullEndpoint());
    const root = endpointHeadingId('get', '/links/{id}');

    // No Try It tab exists any more.
    expect(
      screen.queryByRole('tab', { name: 'Try It' }),
    ).not.toBeInTheDocument();

    // The cURL group + its Copy button live inside the Request panel.
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

    // The JSON body block and the cURL block are both labelled groups with
    // distinct, non-prefix-colliding names sourced from visible text.
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

    // The Request panel always owns focusable descendants (at minimum the cURL
    // Copy button + scrollable <pre>), so the panel itself is never a tab stop.
    const requestPanel = container.querySelector(`#${root}-panel-request`)!;
    expect(requestPanel).not.toHaveAttribute('tabindex');
  });

  it('keeps the Request panel off the tab order even for a body-less endpoint (cURL carries the focus)', () => {
    // Parameters but no request body: no example-body block renders, yet the
    // always-present cURL Copy button + <pre> keep the panel focusable-owning,
    // so the panel drops its own tabIndex rather than becoming the tab stop.
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

    // Request is the default selection.
    expect(requestPanel).not.toHaveAttribute('hidden');
    expect(responsePanel).toHaveAttribute('hidden');

    await user.click(screen.getByRole('tab', { name: 'Response' }));

    expect(requestPanel).toHaveAttribute('hidden');
    expect(responsePanel).not.toHaveAttribute('hidden');

    // The now-hidden Request panel is still mounted (cURL group in the DOM),
    // not torn down – hidden:true reaches into the collapsed subtree.
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
    // Request is the default anchor, so open Response to reveal its sub-tablist.
    await user.click(screen.getByRole('tab', { name: 'Response' }));
    expect(screen.getByRole('tab', { name: 'Response 204' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('drops the Response tab and keeps only the Request tab when there are no responses', () => {
    // No responses ⇒ a single Request tab survives; index 0 lands on it and its
    // panel is a rendered, non-hidden panel hosting the cURL example.
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
    // The parent (ApiReference) keys EndpointDetail by slug, so an endpoint
    // swap remounts it; a fresh mount re-initializes the selection to Request.
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

    // Focus the first (default-selected) pill, then arrow rightward. The nav
    // hook focuses AND clicks each destination, so selection follows focus.
    await user.click(within(sections).getByRole('tab', { name: 'Request' }));

    await user.keyboard('{ArrowRight}');
    expect(
      within(sections).getByRole('tab', { name: 'Response' }),
    ).toHaveAttribute('aria-selected', 'true');

    // Rightward off the last pill wraps back to the first.
    await user.keyboard('{ArrowRight}');
    expect(
      within(sections).getByRole('tab', { name: 'Request' }),
    ).toHaveAttribute('aria-selected', 'true');

    // Leftward off the first pill wraps to the last.
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

    // Reveal the Response section so its nested "Responses" sub-tablist mounts
    // visibly, then scope every query into the inner tablist to disambiguate
    // it from the outer pills.
    await user.click(within(sections).getByRole('tab', { name: 'Response' }));
    const responses = screen.getByRole('tablist', { name: 'Responses' });

    // The first status tab is selected on render; focus it and arrow inward.
    expect(
      within(responses).getByRole('tab', { name: 'Response 200' }),
    ).toHaveAttribute('aria-selected', 'true');
    await user.click(
      within(responses).getByRole('tab', { name: 'Response 200' }),
    );
    await user.keyboard('{ArrowRight}');

    // The inner arrow cycled the status tabs …
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

    // Select Response, then move the inner selection off its default so a stale
    // outer arrow would be detectable.
    await user.click(within(sections).getByRole('tab', { name: 'Response' }));
    const responses = screen.getByRole('tablist', { name: 'Responses' });
    await user.click(
      within(responses).getByRole('tab', { name: 'Response 401' }),
    );

    // Refocus an OUTER pill and arrow across the top-level sections.
    await user.click(within(sections).getByRole('tab', { name: 'Response' }));
    await user.keyboard('{ArrowLeft}');
    expect(
      within(sections).getByRole('tab', { name: 'Request' }),
    ).toHaveAttribute('aria-selected', 'true');

    // The (now-hidden but still-mounted) Responses tablist kept its 401 pick.
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

    // Select the Response pill (index 1) so selectedIndex points past what a
    // response-less endpoint will offer.
    await user.click(screen.getByRole('tab', { name: 'Response' }));
    expect(screen.getByRole('tab', { name: 'Response' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    // Same key ⇒ selectedIndex (1) survives the rerender, but the new endpoint
    // offers only the always-present Request section (no responses). Without
    // the Math.min clamp, index 1 would match no visible section and every
    // panel would hide (a phantom, blank detail).
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

    // The clamp rescues the stale index (1 → 0), so the surviving Request panel
    // stays visible rather than leaving the detail body empty.
    const requestPanel = screen.getByRole('tabpanel', { name: 'Request' });
    expect(requestPanel).not.toHaveAttribute('hidden');
    expect(
      within(requestPanel).getByRole('group', {
        name: 'Example request',
      }),
    ).toBeInTheDocument();
  });
});
