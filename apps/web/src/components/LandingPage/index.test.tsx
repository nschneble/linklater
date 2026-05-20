import { render, screen } from '@testing-library/react';
import LandingPage from './index';
import { MemoryRouter } from 'react-router-dom';

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

  it('links to /signup for Get started free', () => {
    renderLandingPage();
    expect(
      screen.getByRole('link', { name: /get started free/i }),
    ).toHaveAttribute('href', '/signup');
  });

  it('links to /login for Log in', () => {
    renderLandingPage();
    expect(screen.getByRole('link', { name: /^log in$/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('renders all three feature tiles', () => {
    renderLandingPage();
    expect(screen.getByText('Save')).toBeInTheDocument();
    expect(screen.getByText('Stumble!')).toBeInTheDocument();
    expect(screen.getByText('Share')).toBeInTheDocument();
  });

  it('renders a visually-hidden "Features" heading inside the features section', () => {
    renderLandingPage();
    // The heading is sr-only but still in the DOM and accessible to screen
    // readers. getByRole finds it regardless of visibility class.
    const featuresHeading = screen.getByRole('heading', { name: /^features$/i });
    expect(featuresHeading).toBeInTheDocument();
    expect(featuresHeading).toHaveClass('sr-only');
  });

  it('features section has aria-label="Features"', () => {
    renderLandingPage();
    expect(screen.getByRole('region', { name: /^features$/i })).toBeInTheDocument();
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
