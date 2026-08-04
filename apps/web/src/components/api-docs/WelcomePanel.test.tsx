import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WELCOME_HEADING_ID } from './useApiReferenceSelection';
import WelcomePanel from './WelcomePanel';

describe('WelcomePanel', () => {
  it('renders a focusable overview heading off the tab order', () => {
    render(<WelcomePanel serverOrigin="" />);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveAttribute('id', WELCOME_HEADING_ID);
    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it('labels its region by the overview heading', () => {
    render(<WelcomePanel serverOrigin="" />);
    const region = screen.getByRole('region');
    expect(region).toHaveAttribute('aria-labelledby', WELCOME_HEADING_ID);
  });

  it('shows an explicit server origin as the base URL', () => {
    render(<WelcomePanel serverOrigin="https://api.example.com" />);
    expect(screen.getByText('https://api.example.com')).toBeInTheDocument();
  });

  it('falls back to the app origin when same-origin', () => {
    render(<WelcomePanel serverOrigin="" />);
    expect(screen.getByText(window.location.origin)).toBeInTheDocument();
  });

  it('gives a visiting user token guidance, not a wired-in key', () => {
    render(<WelcomePanel serverOrigin="" />);
    expect(
      screen.getByText(/a personal access token is required/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/wired in/i)).not.toBeInTheDocument();
  });
});
