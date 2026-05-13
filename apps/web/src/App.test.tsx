import App from './App';
import { AuthProvider } from './auth/AuthContext';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeContext';
import { render, screen } from '@testing-library/react';

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
});
