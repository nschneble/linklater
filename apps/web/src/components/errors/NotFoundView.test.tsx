import NotFoundView from './NotFoundView';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => {
  mockNavigate.mockClear();
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NotFoundView />
    </MemoryRouter>,
  );
}

describe('NotFoundView', () => {
  it('renders page not found content', () => {
    renderAt('/not-found');
    expect(
      screen.getByRole('heading', { name: /page not found/i }),
    ).toBeInTheDocument();
  });

  it('redirects to /not-found when rendered on a different path', () => {
    renderAt('/some/random/path');
    expect(mockNavigate).toHaveBeenCalledWith('/not-found', { replace: true });
  });

  it('does not redirect when already on /not-found', () => {
    renderAt('/not-found');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
