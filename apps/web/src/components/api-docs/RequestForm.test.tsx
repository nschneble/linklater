import RequestForm from './RequestForm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { NormalizedEndpoint } from '../../lib/openapi';

function makeEndpoint(
  overrides: Partial<NormalizedEndpoint> = {},
): NormalizedEndpoint {
  return {
    method: 'get',
    path: '/links',
    parameters: [],
    responses: [{ statusCode: '200' }],
    ...overrides,
  };
}

interface RenderOptions {
  endpoint?: NormalizedEndpoint;
  token?: string;
  loading?: boolean;
  error?: string | null;
  serverOrigin?: string;
}

function renderForm(options: RenderOptions = {}) {
  const {
    endpoint = makeEndpoint(),
    token = 'ltk_secret_value',
    loading = false,
    error = null,
    serverOrigin = 'https://api.example.com',
  } = options;
  return render(
    <MemoryRouter>
      <RequestForm
        endpoint={endpoint}
        headingId="endpoint-get-links"
        serverOrigin={serverOrigin}
        token={token}
        loading={loading}
        error={error}
      />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('RequestForm – logged in', () => {
  it('submits a substituted URL, Bearer header and body, and announces the result', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('{"id":"abc"}', { status: 200, statusText: 'OK' }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();

    renderForm({
      endpoint: makeEndpoint({
        method: 'post',
        path: '/links/{id}',
        parameters: [
          {
            name: 'id',
            location: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          schema: { type: 'object', properties: { url: { type: 'string' } } },
        },
        responses: [{ statusCode: '200' }],
      }),
    });

    await user.type(screen.getByLabelText(/id/i), 'xyz');
    const submit = screen.getByRole('button', { name: /send request/i });
    await user.click(submit);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe('https://api.example.com/links/xyz');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer ltk_secret_value',
    );
    expect(init.body).toContain('"url"');

    await vi.waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        'Response received: 200 OK.',
      );
    });
    expect(screen.getByText('200 OK')).toBeInTheDocument();
  });

  it('keeps the persistent status node mounted across the request lifecycle', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200, statusText: 'OK' }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm();

    const statusBefore = screen.getByRole('status');
    await user.click(screen.getByRole('button', { name: /send request/i }));
    await vi.waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('200 OK');
    });
    expect(screen.getByRole('status')).toBe(statusBefore);
  });
});

describe('RequestForm – validation', () => {
  it('blocks submit, marks aria-invalid and focuses the first empty required field', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm({
      endpoint: makeEndpoint({
        path: '/links/{id}',
        parameters: [
          {
            name: 'id',
            location: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
      }),
    });

    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(screen.getByLabelText(/id/i)).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });
    expect(screen.getByLabelText(/id/i)).toHaveFocus();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('clears aria-invalid once the required field is filled and resubmitted', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200, statusText: 'OK' }));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm({
      endpoint: makeEndpoint({
        path: '/links/{id}',
        parameters: [
          {
            name: 'id',
            location: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
      }),
    });

    await user.click(screen.getByRole('button', { name: /send request/i }));
    const input = screen.getByLabelText(/id/i);
    await user.type(input, 'abc');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(input).not.toHaveAttribute('aria-invalid');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('blocks submit when the request body is not valid JSON and does not fetch', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm({
      endpoint: makeEndpoint({
        method: 'post',
        requestBody: {
          required: true,
          schema: { type: 'object', properties: { url: { type: 'string' } } },
        },
      }),
    });

    const textarea = screen.getByLabelText(/request body/i);
    await user.clear(textarea);
    await user.type(textarea, '{{ not json');
    await user.click(screen.getByRole('button', { name: /send request/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(textarea).toHaveAttribute('aria-invalid', 'true');
    });
    expect(screen.getByText(/not valid JSON/i)).toBeInTheDocument();
  });
});

describe('RequestForm – in flight', () => {
  it('disables submit, sets aria-busy and announces sending, guarding double submit', async () => {
    let resolveFetch: (response: Response) => void = () => {};
    const fetchMock = vi.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm();

    const submit = screen.getByRole('button', { name: /send request/i });
    await user.click(submit);

    expect(screen.getByRole('status')).toHaveTextContent('Sending request…');
    expect(submit).toBeDisabled();

    // Double-submit guard: a second click while pending must not re-fetch.
    await user.click(submit);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch(new Response('{}', { status: 200, statusText: 'OK' }));
    await vi.waitFor(() => {
      expect(submit).not.toBeDisabled();
    });
  });
});

describe('RequestForm – network failure', () => {
  it('reports a transport failure in the status region without throwing', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm({ serverOrigin: 'https://api.example.com' });

    await user.click(screen.getByRole('button', { name: /send request/i }));

    await vi.waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(
        /Request failed: could not reach https:\/\/api\.example\.com/,
      );
    });
  });
});

describe('RequestForm – logged out', () => {
  it('renders fields aria-disabled + readOnly (still focusable), with a login link, and never fetches', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    renderForm({
      token: '',
      endpoint: makeEndpoint({
        path: '/links/{id}',
        parameters: [
          {
            name: 'id',
            location: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
      }),
    });

    const input = screen.getByLabelText(/id/i);
    expect(input).toHaveAttribute('aria-disabled', 'true');
    expect(input).toHaveAttribute('readonly');
    expect(input).not.toBeDisabled(); // not native-disabled → stays in the AT tree

    // Still focusable.
    input.focus();
    expect(input).toHaveFocus();

    const explanation = screen.getByText(/log in to send live requests/i);
    expect(explanation).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /log in to send live requests/i }),
    ).toHaveAttribute('href', '/login');

    await user.click(screen.getByRole('button', { name: /send request/i }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('RequestForm – token hook error', () => {
  it('shows an alert and keeps the form inert when the token failed to load', () => {
    renderForm({ token: '', error: 'boom' });
    expect(
      screen.getByText(/Couldn.t load your API token\. Reload to try again\./i),
    ).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('RequestForm – token security', () => {
  it('never renders the token into the DOM, response, or announcement', async () => {
    const token = 'ltk_super_secret_value';
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response('{"ok":true}', { status: 200, statusText: 'OK' }),
      );
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    const { container } = renderForm({ token });

    await user.click(screen.getByRole('button', { name: /send request/i }));
    await vi.waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('200 OK');
    });

    expect(container.innerHTML).not.toContain(token);
    expect(container.innerHTML).not.toContain('ltk_');
  });
});
