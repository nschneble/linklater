import WelcomePanel from './WelcomePanel';
import { WELCOME_HEADING_ID } from './useApiReferenceSelection';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('WelcomePanel', () => {
  it('renders a focusable overview heading off the tab order', () => {
    render(<WelcomePanel serverOrigin="" loggedIn={false} />);
    const heading = screen.getByRole('heading', { level: 3 });
    expect(heading).toHaveAttribute('id', WELCOME_HEADING_ID);
    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it('labels its region by the overview heading', () => {
    render(<WelcomePanel serverOrigin="" loggedIn={false} />);
    const region = screen.getByRole('region');
    expect(region).toHaveAttribute('aria-labelledby', WELCOME_HEADING_ID);
  });

  it('shows an explicit server origin as the base URL', () => {
    render(
      <WelcomePanel serverOrigin="https://api.example.com" loggedIn={false} />,
    );
    expect(screen.getByText('https://api.example.com')).toBeInTheDocument();
  });

  it('falls back to the app origin when same-origin', () => {
    render(<WelcomePanel serverOrigin="" loggedIn={false} />);
    expect(screen.getByText(window.location.origin)).toBeInTheDocument();
  });

  it('tailors the auth guidance for a signed-in user', () => {
    render(<WelcomePanel serverOrigin="" loggedIn />);
    expect(
      screen.getByText(/your personal key is already wired in/i),
    ).toBeInTheDocument();
  });

  it('prompts a logged-out user to log in for a key', () => {
    render(<WelcomePanel serverOrigin="" loggedIn={false} />);
    expect(
      screen.getByText(/a key is provisioned for you automatically/i),
    ).toBeInTheDocument();
  });
});
