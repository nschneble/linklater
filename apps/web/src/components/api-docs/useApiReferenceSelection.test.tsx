import { endpointHeadingId, endpointSlug } from './endpointId';
import {
  useApiReferenceSelection,
  WELCOME_HEADING_ID,
} from './useApiReferenceSelection';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { NormalizedEndpoint } from '../../lib/openapi';

const endpoints: NormalizedEndpoint[] = [
  { method: 'get', path: '/links', parameters: [], responses: [] },
  { method: 'delete', path: '/links/{id}', parameters: [], responses: [] },
];

/**
 * Harness: drives the hook and renders the two endpoint headings plus the
 * welcome heading so the focus effect has real targets to move to. Selection
 * buttons stand in for the real nav.
 */
function Harness() {
  const { selectedSlug, selectedEndpoint, selectEndpoint } =
    useApiReferenceSelection(endpoints);

  return (
    <div>
      <p data-testid="selected">{selectedSlug || 'welcome'}</p>
      {endpoints.map((endpoint) => {
        const slug = endpointSlug(endpoint.method, endpoint.path);
        return (
          <button key={slug} type="button" onClick={() => selectEndpoint(slug)}>
            select {slug}
          </button>
        );
      })}
      <button type="button" onClick={() => selectEndpoint('')}>
        select welcome
      </button>

      <h2 id={WELCOME_HEADING_ID} tabIndex={-1}>
        Overview
      </h2>
      {selectedEndpoint && (
        <h2
          id={endpointHeadingId(selectedEndpoint.method, selectedEndpoint.path)}
          tabIndex={-1}
        >
          {selectedEndpoint.method} {selectedEndpoint.path}
        </h2>
      )}
    </div>
  );
}

function renderHarness(initialEntry = '/api-docs') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Harness />
    </MemoryRouter>,
  );
}

describe('useApiReferenceSelection', () => {
  it('resolves to the welcome panel when the hash is empty', () => {
    renderHarness('/api-docs');
    expect(screen.getByTestId('selected')).toHaveTextContent('welcome');
  });

  it('resolves the selected endpoint from a deep-link hash', () => {
    renderHarness('/api-docs#delete-links-id');
    expect(screen.getByTestId('selected')).toHaveTextContent('delete-links-id');
  });

  it('falls back to the welcome panel for an unknown hash', () => {
    renderHarness('/api-docs#nope');
    expect(screen.getByTestId('selected')).toHaveTextContent('welcome');
  });

  it('does NOT steal focus on initial deep-linked load', () => {
    renderHarness('/api-docs#get-links');
    expect(document.activeElement).toBe(document.body);
  });

  it('updates the hash and moves focus to the heading on selection', async () => {
    const user = userEvent.setup();
    renderHarness('/api-docs');

    await user.click(screen.getByRole('button', { name: 'select get-links' }));

    expect(screen.getByTestId('selected')).toHaveTextContent('get-links');
    expect(document.activeElement).toBe(
      document.getElementById(endpointHeadingId('get', '/links')),
    );
  });

  it('returns to the welcome panel and focuses its heading', async () => {
    const user = userEvent.setup();
    renderHarness('/api-docs#get-links');

    await user.click(screen.getByRole('button', { name: 'select welcome' }));

    expect(screen.getByTestId('selected')).toHaveTextContent('welcome');
    expect(document.activeElement).toBe(
      document.getElementById(WELCOME_HEADING_ID),
    );
  });
});
