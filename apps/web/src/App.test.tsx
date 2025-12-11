import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { ThemeProvider } from './theme/ThemeContext';

function renderWithProviders() {
  render(
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>,
  );
}

describe('App auth UI', () => {
  it('shows the auth form when not logged in', () => {
    renderWithProviders();
    expect(
      screen.getByText(/Save links now, read them later/i),
    ).toBeInTheDocument();
  });

  it('lets you toggle between login and sign up modes', () => {
    renderWithProviders();
    const signupTab = screen.getByRole('button', { name: /Sign up/i });
    fireEvent.click(signupTab);
    expect(
      screen.getByRole('button', { name: /Create account/i }),
    ).toBeInTheDocument();
  });
});
