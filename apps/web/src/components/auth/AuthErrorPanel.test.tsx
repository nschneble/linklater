import AuthErrorPanel from './AuthErrorPanel';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const defaults = {
  errorMessage: 'Something went wrong.',
  explanation: 'Please try again from the login page.',
};

describe('AuthErrorPanel', () => {
  it('renders the error message inside a role="alert" element', () => {
    render(<AuthErrorPanel {...defaults} onBackToLogin={vi.fn()} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong.');
  });

  it('renders the explanation paragraph below the alert', () => {
    render(<AuthErrorPanel {...defaults} onBackToLogin={vi.fn()} />);

    expect(
      screen.getByText('Please try again from the login page.'),
    ).toBeInTheDocument();
  });

  it('renders a "Back to login" button by default', () => {
    render(<AuthErrorPanel {...defaults} onBackToLogin={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Back to login' }),
    ).toBeInTheDocument();
  });

  it('supports overriding the back button label', () => {
    render(
      <AuthErrorPanel
        {...defaults}
        backLabel="Return to sign-in"
        onBackToLogin={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Return to sign-in' }),
    ).toBeInTheDocument();
  });

  it('invokes onBackToLogin when the back button is clicked', () => {
    const onBackToLogin = vi.fn();
    render(<AuthErrorPanel {...defaults} onBackToLogin={onBackToLogin} />);

    fireEvent.click(screen.getByRole('button', { name: 'Back to login' }));

    expect(onBackToLogin).toHaveBeenCalledTimes(1);
  });

  it('renders the back button as type="button" so it never submits a form', () => {
    render(<AuthErrorPanel {...defaults} onBackToLogin={vi.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Back to login' }),
    ).toHaveAttribute('type', 'button');
  });

  it('does not focus anything on mount (relies on role="alert" live region)', () => {
    render(<AuthErrorPanel {...defaults} onBackToLogin={vi.fn()} />);

    // Body is the default focused element; verify the panel did not steal focus.
    expect(document.activeElement).toBe(document.body);
  });
});
