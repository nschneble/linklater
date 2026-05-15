import { fireEvent, render, screen } from '@testing-library/react';
import LandingPage from './index';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderLandingPage() {
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the app name', () => {
    renderLandingPage();
    expect(
      screen.getByRole('heading', { name: /linklater/i }),
    ).toBeInTheDocument();
  });

  it('navigates to /signup when Get started free is clicked', () => {
    renderLandingPage();
    fireEvent.click(screen.getByRole('button', { name: /get started free/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/signup');
  });

  it('navigates to /login when Log in is clicked', () => {
    renderLandingPage();
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('renders all three feature tiles', () => {
    renderLandingPage();
    expect(screen.getByText('Save in a flash')).toBeInTheDocument();
    expect(screen.getByText('Stumble')).toBeInTheDocument();
    expect(screen.getByText('Keyboard-first')).toBeInTheDocument();
  });

  it('renders footer links with correct hrefs', () => {
    renderLandingPage();
    expect(screen.getByRole('link', { name: /about/i })).toHaveAttribute(
      'href',
      'https://nickschneble.xyz/',
    );
    expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute(
      'href',
      'https://github.com/nschneble/linklater',
    );
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute(
      'href',
      'mailto:linklater@fancyenchiladas.net',
    );
  });
});
