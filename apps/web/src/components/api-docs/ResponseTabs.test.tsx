import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import ResponseTabs from './ResponseTabs';
import { endpointHeadingId } from './endpointId';
import { FOCUS_RING } from '../../lib/styles';
import type { NormalizedEndpoint } from '../../lib/openapi';

function makeEndpoint(
  overrides: Partial<NormalizedEndpoint> = {},
): NormalizedEndpoint {
  return {
    method: 'get',
    path: '/links',
    summary: 'List links',
    parameters: [],
    responses: [
      {
        statusCode: '200',
        description: 'OK',
        schema: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
      },
      { statusCode: '401', description: 'Unauthorized' },
    ],
    ...overrides,
  };
}

describe('ResponseTabs', () => {
  it('renders a horizontal tablist of status-code tabs named "{code} {description}"', () => {
    render(<ResponseTabs endpoint={makeEndpoint()} />);
    const tablist = screen.getByRole('tablist', { name: 'Responses' });
    expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');
    expect(screen.getByRole('tab', { name: '200 OK' })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: '401 Unauthorized' }),
    ).toBeInTheDocument();
  });

  it('falls back to "Response {code}" when a response has no description', () => {
    render(
      <ResponseTabs
        endpoint={makeEndpoint({ responses: [{ statusCode: '204' }] })}
      />,
    );
    expect(
      screen.getByRole('tab', { name: 'Response 204' }),
    ).toBeInTheDocument();
  });

  it('selects the first response on render and shows only its body', () => {
    render(<ResponseTabs endpoint={makeEndpoint()} />);
    expect(screen.getByRole('tab', { name: '200 OK' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(
      screen.getByRole('tab', { name: '401 Unauthorized' }),
    ).toHaveAttribute('aria-selected', 'false');
    expect(
      screen.getByRole('table', { name: /response body/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText('None')).not.toBeInTheDocument();
  });

  it('auto-selects the single pill of a 204-only endpoint so the fallback shows', () => {
    render(
      <ResponseTabs
        endpoint={makeEndpoint({ responses: [{ statusCode: '204' }] })}
      />,
    );
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('swaps the panel to the clicked response body or fallback', async () => {
    const user = userEvent.setup();
    render(<ResponseTabs endpoint={makeEndpoint()} />);
    await user.click(screen.getByRole('tab', { name: '401 Unauthorized' }));
    expect(
      screen.getByRole('tab', { name: '401 Unauthorized' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: /response body/i }),
    ).not.toBeInTheDocument();
  });

  it('moves selection with ArrowRight, wrapping at the end', async () => {
    const user = userEvent.setup();
    render(<ResponseTabs endpoint={makeEndpoint()} />);
    await user.tab();
    expect(screen.getByRole('tab', { name: '200 OK' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(
      screen.getByRole('tab', { name: '401 Unauthorized' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '401 Unauthorized' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: '200 OK' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('moves selection with ArrowLeft, wrapping backward to the last tab', async () => {
    const user = userEvent.setup();
    render(<ResponseTabs endpoint={makeEndpoint()} />);
    await user.tab();
    expect(screen.getByRole('tab', { name: '200 OK' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(
      screen.getByRole('tab', { name: '401 Unauthorized' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '401 Unauthorized' })).toHaveFocus();
  });

  it('jumps to the last tab with End and the first with Home', async () => {
    const user = userEvent.setup();
    render(<ResponseTabs endpoint={makeEndpoint()} />);
    await user.tab();
    await user.keyboard('{End}');
    expect(
      screen.getByRole('tab', { name: '401 Unauthorized' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '401 Unauthorized' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: '200 OK' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: '200 OK' })).toHaveFocus();
  });

  it('keeps a single Tab stop via roving tabindex', () => {
    render(<ResponseTabs endpoint={makeEndpoint()} />);
    expect(screen.getByRole('tab', { name: '200 OK' })).toHaveAttribute(
      'tabindex',
      '0',
    );
    expect(
      screen.getByRole('tab', { name: '401 Unauthorized' }),
    ).toHaveAttribute('tabindex', '-1');
  });

  it('labels the single shared panel by the active tab and wires aria-controls', () => {
    render(<ResponseTabs endpoint={makeEndpoint()} />);
    const panel = screen.getByRole('tabpanel');
    const panelId = `${endpointHeadingId('get', '/links')}-resp-panel`;
    const activeTabId = `${endpointHeadingId('get', '/links')}-resp-tab-200`;
    expect(panel).toHaveAttribute('id', panelId);
    expect(panel).toHaveAttribute('aria-labelledby', activeTabId);
    // The default 200 response carries a body schema, so its example CodeBlock
    // owns the focus stop and the shared panel drops its own tabIndex (the
    // schema-present/absent tab-stop behaviour is pinned in its own tests below).
    expect(panel).not.toHaveAttribute('tabindex');
    expect(screen.getByRole('tab', { name: '200 OK' })).toHaveAttribute(
      'aria-controls',
      panelId,
    );
  });

  it('renders an example response body block after the table for a schema-bearing status, dropping the panel tab stop', () => {
    render(<ResponseTabs endpoint={makeEndpoint()} />);
    const root = endpointHeadingId('get', '/links');

    // A labelled, focusable <pre> group carrying the -response-example id. Its
    // JSON is DERIVED from buildExampleFromSchema (the "id" property from the
    // 200 schema appears), never hardcoded.
    const example = screen.getByRole('group', {
      name: 'Example response body',
    });
    expect(example).toHaveAttribute(
      'aria-labelledby',
      `${root}-response-example`,
    );
    expect(example).toHaveTextContent('"id"');

    // Reading order: the response-body table precedes the example block.
    const panel = screen.getByRole('tabpanel');
    const table = within(panel).getByRole('table', {
      name: /response body/i,
    });
    expect(
      table.compareDocumentPosition(example) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // With the CodeBlock supplying the focus stop, the shared panel drops its
    // own tabIndex + ring so there is no dead ring or duplicate tab stop.
    expect(panel).not.toHaveAttribute('tabindex');
    expect(panel.className).not.toContain(FOCUS_RING);
  });

  it('round-trips the panel tab stop: gains tabIndex on a body-less status, RE-DROPS it back on a body-bearing one', async () => {
    const user = userEvent.setup();
    render(<ResponseTabs endpoint={makeEndpoint()} />);
    const tablist = screen.getByRole('tablist', { name: 'Responses' });

    // Forward: select the body-less 401 ⇒ no example block, and the read-only
    // "None" fallback makes the panel itself the keyboard-reachable
    // focus stop (tabIndex=0 + the shared ring).
    await user.click(
      within(tablist).getByRole('tab', { name: '401 Unauthorized' }),
    );
    expect(
      screen.queryByRole('group', { name: 'Example response body' }),
    ).not.toBeInTheDocument();
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(panel.className).toContain(FOCUS_RING);

    // Reverse: click BACK to the body-bearing 200, whose example CodeBlock owns
    // the focus stop. The panel must RE-DROP its own tabIndex + ring — a "sticky
    // tabindex" regression (gains tabIndex=0 and never clears) would survive the
    // forward-only assertion above but fails here.
    await user.click(within(tablist).getByRole('tab', { name: '200 OK' }));
    expect(panel).not.toHaveAttribute('tabindex');
    expect(panel.className).not.toContain(FOCUS_RING);
  });
});
