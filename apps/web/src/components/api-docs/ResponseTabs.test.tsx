import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import ResponseTabs from './ResponseTabs';
import { endpointHeadingId } from './endpointId';
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
      screen.getByRole('table', { name: /200 response body/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No response body\./i)).not.toBeInTheDocument();
  });

  it('auto-selects the single pill of a 204-only endpoint so the fallback shows', () => {
    render(
      <ResponseTabs
        endpoint={makeEndpoint({ responses: [{ statusCode: '204' }] })}
      />,
    );
    expect(screen.getByText(/No response body\./i)).toBeInTheDocument();
  });

  it('swaps the panel to the clicked response body or fallback', async () => {
    const user = userEvent.setup();
    render(<ResponseTabs endpoint={makeEndpoint()} />);
    await user.click(screen.getByRole('tab', { name: '401 Unauthorized' }));
    expect(
      screen.getByRole('tab', { name: '401 Unauthorized' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText(/No response body\./i)).toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: /200 response body/i }),
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
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: '200 OK' })).toHaveAttribute(
      'aria-controls',
      panelId,
    );
  });
});
