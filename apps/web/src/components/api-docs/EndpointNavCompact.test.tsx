import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NormalizedEndpoint } from '../../lib/openapi';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

import EndpointNavCompact from './EndpointNavCompact';

const endpoints: NormalizedEndpoint[] = [
  { method: 'get', path: '/links', parameters: [], responses: [] },
  { method: 'delete', path: '/links/{id}', parameters: [], responses: [] },
];

beforeEach(() => {
  // jsdom does not implement scrollIntoView; stub it so the active-chip effect
  // can run.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('EndpointNavCompact', () => {
  it('exposes a distinct "(compact)" navigation landmark', () => {
    render(
      <EndpointNavCompact
        endpoints={endpoints}
        selectedSlug=""
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('navigation', { name: 'API endpoints (compact)' }),
    ).toBeInTheDocument();
  });

  it('marks the selected chip aria-current and scrolls it into view', () => {
    render(
      <EndpointNavCompact
        endpoints={endpoints}
        selectedSlug="delete-links-id"
        onSelect={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'DELETE /links/{id}' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('calls onSelect with the slug on click', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <EndpointNavCompact
        endpoints={endpoints}
        selectedSlug=""
        onSelect={onSelect}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'GET /links' }));
    expect(onSelect).toHaveBeenCalledWith('get-links');
  });
});
