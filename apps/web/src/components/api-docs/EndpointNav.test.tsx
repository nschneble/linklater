import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { NormalizedEndpoint } from '../../lib/openapi';

vi.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

import EndpointNav from './EndpointNav';

const endpoints: NormalizedEndpoint[] = [
  { method: 'get', path: '/links', parameters: [], responses: [] },
  { method: 'post', path: '/links', parameters: [], responses: [] },
  { method: 'delete', path: '/links/{id}', parameters: [], responses: [] },
];

describe('EndpointNav', () => {
  it('exposes a single "API endpoints" navigation landmark', () => {
    render(
      <EndpointNav endpoints={endpoints} selectedSlug="" onSelect={vi.fn()} />,
    );
    expect(
      screen.getByRole('navigation', { name: 'API endpoints' }),
    ).toBeInTheDocument();
  });

  it('names each item method-first ("GET /links")', () => {
    render(
      <EndpointNav endpoints={endpoints} selectedSlug="" onSelect={vi.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: 'GET /links' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'DELETE /links/{id}' }),
    ).toBeInTheDocument();
  });

  it('marks only the selected item aria-current="page"', () => {
    render(
      <EndpointNav
        endpoints={endpoints}
        selectedSlug="post-links"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'POST /links' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      screen.getByRole('button', { name: 'GET /links' }),
    ).not.toHaveAttribute('aria-current');
  });

  it('calls onSelect with the endpoint slug on click', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <EndpointNav endpoints={endpoints} selectedSlug="" onSelect={onSelect} />,
    );
    await user.click(
      screen.getByRole('button', { name: 'DELETE /links/{id}' }),
    );
    expect(onSelect).toHaveBeenCalledWith('delete-links-id');
  });
});
