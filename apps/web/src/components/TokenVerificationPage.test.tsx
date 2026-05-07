import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TokenVerificationPage from './TokenVerificationPage';

afterEach(() => vi.restoreAllMocks());

const DEFAULT_PROPS = {
  title: 'Test Verification',
  verifyingText: 'Verifying…',
  successText: 'All done!',
  helpText: 'Something went wrong.',
  verifyFn: vi.fn(),
};

function renderPage(props = DEFAULT_PROPS, search = '?token=abc123') {
  return render(
    <MemoryRouter initialEntries={[`/verify${search}`]}>
      <TokenVerificationPage {...props} />
    </MemoryRouter>,
  );
}

describe('TokenVerificationPage', () => {
  it('renders the provided title', () => {
    DEFAULT_PROPS.verifyFn.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Test Verification')).toBeInTheDocument();
  });

  it('shows the verifying text while the request is in flight', () => {
    DEFAULT_PROPS.verifyFn.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Verifying…')).toBeInTheDocument();
  });

  it('shows the success text after verifyFn resolves', async () => {
    DEFAULT_PROPS.verifyFn.mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('All done!')).toBeInTheDocument();
    });
  });

  it('shows a Go to Linklater button after success', async () => {
    DEFAULT_PROPS.verifyFn.mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /go to linklater/i }),
      ).toBeInTheDocument();
    });
  });

  it('shows an error when no token is in the URL', async () => {
    renderPage(DEFAULT_PROPS, '');

    await waitFor(() => {
      expect(
        screen.getByText(/no verification token found/i),
      ).toBeInTheDocument();
    });
  });

  it('shows an error when verifyFn rejects with an Error', async () => {
    DEFAULT_PROPS.verifyFn.mockRejectedValue(new Error('Token expired'));
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Token expired')).toBeInTheDocument();
    });
  });

  it('shows a fallback error message for non-Error rejections', async () => {
    DEFAULT_PROPS.verifyFn.mockRejectedValue('unknown');
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Verification failed.')).toBeInTheDocument();
    });
  });

  it('shows the helpText on error', async () => {
    renderPage(DEFAULT_PROPS, '');

    await waitFor(() => {
      expect(screen.getByText('Something went wrong.')).toBeInTheDocument();
    });
  });

  it('shows a Back to Linklater button on error', async () => {
    renderPage(DEFAULT_PROPS, '');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /back to linklater/i }),
      ).toBeInTheDocument();
    });
  });

  it('navigation buttons have type="button"', async () => {
    DEFAULT_PROPS.verifyFn.mockResolvedValue(undefined);
    renderPage();

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /go to linklater/i });
      expect(button).toHaveAttribute('type', 'button');
    });
  });

  it('navigates home when Back to Linklater is clicked', async () => {
    renderPage(DEFAULT_PROPS, '');

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /back to linklater/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /back to linklater/i }));
  });
});
