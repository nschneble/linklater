import EndpointCard from './EndpointCard';
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

function renderInList(endpoint: NormalizedEndpoint) {
  return render(
    <ul>
      <EndpointCard endpoint={endpoint} />
    </ul>,
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
});
