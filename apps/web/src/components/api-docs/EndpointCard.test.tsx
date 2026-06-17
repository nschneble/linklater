import EndpointCard from './EndpointCard';
import { MemoryRouter } from 'react-router-dom';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { NormalizedEndpoint } from '../../lib/openapi';

function makeEndpoint(
  overrides: Partial<NormalizedEndpoint> = {},
): NormalizedEndpoint {
  return {
    method: 'get',
    path: '/links',
    summary: 'List links',
    description: 'Returns every saved link.',
    parameters: [],
    responses: [
      {
        statusCode: '200',
        schema: { type: 'object', properties: { id: { type: 'string' } } },
      },
    ],
    ...overrides,
  };
}

interface RenderInListOptions {
  token?: string;
  tokenLoading?: boolean;
  tokenError?: string | null;
  serverOrigin?: string;
}

function renderInList(
  endpoint: NormalizedEndpoint,
  options: RenderInListOptions = {},
) {
  const {
    token = 'ltk_test_token',
    tokenLoading = false,
    tokenError = null,
    serverOrigin = 'https://api.example.com',
  } = options;
  return render(
    <MemoryRouter>
      <ul>
        <EndpointCard
          endpoint={endpoint}
          serverOrigin={serverOrigin}
          token={token}
          tokenLoading={tokenLoading}
          tokenError={tokenError}
        />
      </ul>
    </MemoryRouter>,
  );
}

describe('EndpointCard', () => {
  it('exposes the method in the h3 accessible name, method first (B1)', () => {
    renderInList(makeEndpoint());
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveAccessibleName('GET /links');
  });

  it('labels the <article> by its h3 (S1)', () => {
    renderInList(makeEndpoint());
    const article = screen.getByRole('article', { name: 'GET /links' });
    expect(article.tagName).toBe('ARTICLE');
  });

  it('marks the method badge aria-hidden so it does not double-announce (B1)', () => {
    const { container } = renderInList(makeEndpoint());
    // The visible badge text "GET" sits in an aria-hidden span.
    const badge = container.querySelector('span[aria-hidden="true"]');
    expect(badge).toHaveTextContent('GET');
  });

  it('renders a 204 response as a "No response body." text fallback (T5)', async () => {
    const user = userEvent.setup();
    renderInList(makeEndpoint({ responses: [{ statusCode: '204' }] }));

    await user.click(screen.getByRole('button', { name: 'GET /links' }));
    expect(screen.getByText(/No response body\./)).toBeInTheDocument();
  });

  it('shows the response schema table when the panel is expanded', async () => {
    const user = userEvent.setup();
    renderInList(makeEndpoint());

    await user.click(screen.getByRole('button', { name: 'GET /links' }));
    const table = screen.getByRole('table', { name: '200 response body' });
    expect(
      within(table).getByRole('rowheader', { name: 'id' }),
    ).toBeInTheDocument();
  });

  it('renders a parameters table with location and required text', async () => {
    const user = userEvent.setup();
    renderInList(
      makeEndpoint({
        method: 'delete',
        path: '/links/{id}',
        parameters: [
          {
            name: 'id',
            location: 'path',
            required: true,
            description: 'The link id.',
            schema: { type: 'string' },
          },
          {
            name: 'search',
            location: 'query',
            required: false,
            schema: { type: 'string' },
          },
        ],
      }),
    );

    await user.click(
      screen.getByRole('button', { name: 'DELETE /links/{id}' }),
    );
    const table = screen.getByRole('table', {
      name: 'Path & query parameters',
    });
    const idRow = within(table)
      .getByRole('rowheader', { name: 'id' })
      .closest('tr') as HTMLElement;
    expect(within(idRow).getByText('path')).toBeInTheDocument();
    expect(within(idRow).getByText('Required')).toBeInTheDocument();
  });

  it('renders no parameters table when there are zero parameters (T5)', async () => {
    const user = userEvent.setup();
    renderInList(makeEndpoint({ parameters: [] }));

    await user.click(screen.getByRole('button', { name: 'GET /links' }));
    expect(
      screen.queryByRole('table', { name: 'Path & query parameters' }),
    ).toBeNull();
  });

  it('renders the "try it out" form inside the expanded panel (§1)', async () => {
    const user = userEvent.setup();
    renderInList(makeEndpoint());

    await user.click(screen.getByRole('button', { name: 'GET /links' }));
    expect(
      screen.getByRole('button', { name: /send request/i }),
    ).toBeInTheDocument();
  });

  it('returns focus to the toggle when the panel collapses with focus inside it (§7)', async () => {
    const user = userEvent.setup();
    renderInList(makeEndpoint());

    const toggle = screen.getByRole('button', { name: 'GET /links' });
    await user.click(toggle); // expand

    // Move focus INTO the panel, then collapse via keyboard from the toggle.
    const sendButton = screen.getByRole('button', { name: /send request/i });
    sendButton.focus();
    expect(sendButton).toHaveFocus();

    await user.click(toggle); // collapse
    expect(toggle).toHaveFocus();
  });
});
