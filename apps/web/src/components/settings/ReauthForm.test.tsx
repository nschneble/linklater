import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReauthForm from './ReauthForm';

function renderForm(
  overrides: Partial<React.ComponentProps<typeof ReauthForm>> = {},
) {
  const props: React.ComponentProps<typeof ReauthForm> = {
    prompt: 'Confirm your identity.',
    submitLabel: 'Confirm',
    submittingLabel: 'Confirming…',
    loading: false,
    error: null,
    password: '',
    code: '',
    hasPassword: true,
    onPasswordChange: vi.fn(),
    onCodeChange: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { ...render(<ReauthForm {...props} />), props };
}

describe('ReauthForm — prompt copy', () => {
  it('renders the prompt verbatim', () => {
    renderForm({ prompt: 'Confirm to permanently delete your account.' });
    expect(
      screen.getByText('Confirm to permanently delete your account.'),
    ).toBeInTheDocument();
  });
});

describe('ReauthForm — fields', () => {
  it('shows the password field when hasPassword is true', () => {
    renderForm();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
  });

  it('shows the code field with "Or" prefix when hasPassword is true', () => {
    renderForm();
    expect(
      screen.getByLabelText(/or enter an authenticator or recovery code/i),
    ).toBeInTheDocument();
  });

  it('password input has autoComplete="current-password"', () => {
    renderForm();
    expect(screen.getByLabelText(/current password/i)).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
  });

  it('code input has inputMode="numeric" and autoComplete="one-time-code"', () => {
    renderForm();
    const codeInput = screen.getByLabelText(
      /or enter an authenticator or recovery code/i,
    );
    expect(codeInput).toHaveAttribute('inputmode', 'numeric');
    expect(codeInput).toHaveAttribute('autocomplete', 'one-time-code');
  });

  it('hides the password field when hasPassword is false (passwordless account)', () => {
    renderForm({ hasPassword: false });
    expect(
      screen.queryByLabelText(/current password/i),
    ).not.toBeInTheDocument();
  });

  it('uses a standalone code label when hasPassword is false', () => {
    renderForm({ hasPassword: false });
    expect(
      screen.getByLabelText(/^authenticator or recovery code$/i),
    ).toBeInTheDocument();
  });
});

describe('ReauthForm — interactions', () => {
  it('forwards password input to onPasswordChange', () => {
    const onPasswordChange = vi.fn();
    renderForm({ onPasswordChange });
    fireEvent.change(screen.getByLabelText(/current password/i), {
      target: { value: 'secret' },
    });
    expect(onPasswordChange).toHaveBeenCalledWith('secret');
  });

  it('forwards code input to onCodeChange', () => {
    const onCodeChange = vi.fn();
    renderForm({ onCodeChange });
    fireEvent.change(screen.getByLabelText(/authenticator or recovery code/i), {
      target: { value: '123456' },
    });
    expect(onCodeChange).toHaveBeenCalledWith('123456');
  });

  it('renders the error message when error is set', () => {
    renderForm({ error: 'Invalid credentials' });
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('uses submitLabel when idle and submittingLabel while loading', () => {
    const { rerender, props } = renderForm({
      submitLabel: 'Delete my account',
      submittingLabel: 'Deleting…',
    });
    expect(
      screen.getByRole('button', { name: 'Delete my account' }),
    ).toBeInTheDocument();
    rerender(<ReauthForm {...props} loading={true} />);
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('ReauthForm — accessibility wiring', () => {
  it('links the prompt to both inputs via aria-describedby (no error)', () => {
    renderForm({ prompt: 'Confirm your identity.' });
    const passwordInput = screen.getByLabelText(/current password/i);
    const codeInput = screen.getByLabelText(/authenticator or recovery code/i);
    const promptId = passwordInput.getAttribute('aria-describedby');
    expect(promptId).toBeTruthy();
    expect(codeInput.getAttribute('aria-describedby')).toBe(promptId);
    expect(document.getElementById(promptId!)).toHaveTextContent(
      'Confirm your identity.',
    );
  });

  it('extends aria-describedby with the error id and sets aria-invalid when error is present', () => {
    renderForm({ error: 'Invalid credentials' });
    const passwordInput = screen.getByLabelText(/current password/i);
    const describedBy = passwordInput.getAttribute('aria-describedby')!;
    const ids = describedBy.split(' ');
    expect(ids).toHaveLength(2);
    const errorElement = document.getElementById(ids[1]);
    expect(errorElement).toHaveTextContent('Invalid credentials');
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('moves focus into the error alert when error first appears', () => {
    const { rerender, props } = renderForm({ error: null });
    rerender(<ReauthForm {...props} error="Invalid credentials" />);
    const alertElement = screen.getByRole('alert');
    expect(document.activeElement).toBe(alertElement);
  });

  it('focusOnMount={true} focuses the password input on mount', () => {
    renderForm({ focusOnMount: true });
    expect(document.activeElement).toBe(
      screen.getByLabelText(/current password/i),
    );
  });

  it('focusOnMount={false} (default) does not move focus', () => {
    renderForm();
    expect(document.activeElement).not.toBe(
      screen.getByLabelText(/current password/i),
    );
  });

  it('focusOnMount={true} focuses the code input when hasPassword is false', () => {
    renderForm({ focusOnMount: true, hasPassword: false });
    expect(document.activeElement).toBe(
      screen.getByLabelText(/^authenticator or recovery code$/i),
    );
  });

  it('cancelLabel sets aria-label on the Cancel button (visible text unchanged)', () => {
    renderForm({ cancelLabel: 'Cancel account deletion' });
    const cancelButton = screen.getByRole('button', {
      name: 'Cancel account deletion',
    });
    expect(cancelButton).toHaveTextContent('Cancel');
  });
});
