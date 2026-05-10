import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeContext';
import { fireEvent, render, screen } from '@testing-library/react';

function renderWithProviders() {
  render(
    <MemoryRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ThemeProvider>
    </MemoryRouter>,
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
    const signupTab = screen.getByRole('tab', { name: /Sign up/i });
    fireEvent.click(signupTab);
    expect(
      screen.getByRole('button', { name: /Create account/i }),
    ).toBeInTheDocument();
  });
});
