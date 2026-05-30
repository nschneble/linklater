import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ReauthForm from './ReauthForm';

function renderForm(
  overrides: Partial<React.ComponentProps<typeof ReauthForm>> = {},
) {
  const props: React.ComponentProps<typeof ReauthForm> = {
    action: 'disable',
    loading: false,
    error: null,
    password: '',
    code: '',
    onPasswordChange: vi.fn(),
    onCodeChange: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    onCancel: vi.fn(),
    ...overrides,
  };
  return { ...render(<ReauthForm {...props} />), props };
}

describe('ReauthForm — prompt copy', () => {
  it('uses the disable copy for action="disable"', () => {
    renderForm({ action: 'disable' });
    expect(
      screen.getByText(/confirm your identity to disable/i),
    ).toBeInTheDocument();
  });

  it('uses the regenerate copy for action="regenerate"', () => {
    renderForm({ action: 'regenerate' });
    expect(
      screen.getByText(/confirm your identity to generate new recovery codes/i),
    ).toBeInTheDocument();
  });
});

describe('ReauthForm — fields', () => {
  it('shows the password field', () => {
    renderForm();
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
  });

  it('shows the code field', () => {
    renderForm();
    expect(
      screen.getByLabelText(/or enter an authenticator or recovery code/i),
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

  it('shows "Confirming…" and disables the confirm button while loading', () => {
    renderForm({ loading: true });
    const confirmButton = screen.getByRole('button', { name: /confirming/i });
    expect(confirmButton).toBeDisabled();
  });

  it('calls onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
