import ApiDocsView from './ApiDocsView';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Scalar pulls in a heavy Vue runtime and a non-trivial stylesheet. Stub the
// embed with a small marker component so we can assert the page's
// layout/labels without booting the real renderer in jsdom.
vi.mock('@scalar/api-reference-react', () => ({
  ApiReferenceReact: ({
    configuration,
  }: {
    configuration: { url?: string; darkMode?: boolean };
  }) => (
    <div
      data-testid="scalar-stub"
      data-spec-url={configuration.url ?? ''}
      data-dark-mode={configuration.darkMode ? 'true' : 'false'}
    />
  ),
}));

vi.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ mode: 'light' }),
}));

function renderView() {
  return render(
    <MemoryRouter>
      <ApiDocsView />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ApiDocsView', () => {
  it('renders a single H1 (the rest of headings are H2)', () => {
    renderView();
    const h1s = screen.getAllByRole('heading', { level: 1 });
    expect(h1s).toHaveLength(1);
    expect(h1s[0]).toHaveTextContent(/api documentation/i);
  });

  it('renders the Authenticate section with the token input', () => {
    renderView();
    expect(
      screen.getByRole('heading', { level: 2, name: /authenticate/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/personal access token/i)).toBeInTheDocument();
  });

  it('points Scalar at /openapi.json', () => {
    renderView();
    const stub = screen.getByTestId('scalar-stub');
    expect(stub.getAttribute('data-spec-url')).toMatch(/\/openapi\.json$/);
  });

  it('hydrates the cached token from sessionStorage without announcing it', () => {
    window.sessionStorage.setItem(
      'linklater.api-docs.pat',
      'ltk_cachedValue1234',
    );
    renderView();
    const input = screen.getByLabelText(
      /personal access token/i,
    ) as HTMLInputElement;
    expect(input.value).toBe('ltk_cachedValue1234');
    expect(input).toHaveAttribute('type', 'password');
    expect(screen.getByRole('status')).toHaveTextContent('');
  });

  it('exposes a back-to-Settings link as the first focusable affordance', () => {
    renderView();
    const link = screen.getByRole('link', { name: /back to settings/i });
    expect(link).toHaveAttribute('href', '/settings');
  });
});
