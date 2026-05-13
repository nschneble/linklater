import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import LinkForm from './LinkForm';

vi.mock('../../lib/api', () => ({
  createLink: vi.fn(),
}));

import * as apiModule from '../../lib/api';
import type { Link } from '../../lib/api';

const LINK_URL = 'https://example.com/article';

const makeLink = (overrides: Partial<Link> = {}): Link => ({
  createdAt: '2026-01-01T00:00:00.000Z',
  id: 'link-1',
  updatedAt: '2026-01-01T00:00:00.000Z',
  url: LINK_URL,
  readAt: null,
  meta: null,
  ...overrides,
});

afterEach(() => vi.restoreAllMocks());

describe('LinkForm', () => {
  it('renders a URL input and a Save link button', () => {
    render(<LinkForm onCreated={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /save link/i }),
    ).toBeInTheDocument();
  });

  it('calls onCreated with the returned link on successful save', async () => {
    const link = makeLink();
    vi.mocked(apiModule.createLink).mockResolvedValue(link);
    const onCreated = vi.fn();

    render(<LinkForm onCreated={onCreated} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: LINK_URL },
    });
    fireEvent.click(screen.getByRole('button', { name: /save link/i }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(link);
    });
  });

  it('clears the input after a successful save', async () => {
    vi.mocked(apiModule.createLink).mockResolvedValue(makeLink());

    render(<LinkForm onCreated={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: LINK_URL },
    });
    fireEvent.click(screen.getByRole('button', { name: /save link/i }));

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('');
    });
  });

  it('shows a saving state while the request is in flight', async () => {
    vi.mocked(apiModule.createLink).mockReturnValue(new Promise(() => {}));

    render(<LinkForm onCreated={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: LINK_URL },
    });
    fireEvent.click(screen.getByRole('button', { name: /save link/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
    });
  });

  it('shows an error when the save fails', async () => {
    vi.mocked(apiModule.createLink).mockRejectedValue(new Error('Invalid url'));

    render(<LinkForm onCreated={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: LINK_URL },
    });
    fireEvent.click(screen.getByRole('button', { name: /save link/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Invalid url')).toBeInTheDocument();
    });
  });

  it('shows a fallback error message when the error is not an Error instance', async () => {
    vi.mocked(apiModule.createLink).mockRejectedValue('unknown');

    render(<LinkForm onCreated={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: LINK_URL },
    });
    fireEvent.click(screen.getByRole('button', { name: /save link/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed to save link')).toBeInTheDocument();
    });
  });

  it('does not show an error on initial render', () => {
    render(<LinkForm onCreated={vi.fn()} />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
