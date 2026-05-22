import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MfaView from './MfaView';

function renderView(
  overrides: Partial<React.ComponentProps<typeof MfaView>> = {},
) {
  const props: React.ComponentProps<typeof MfaView> = {
    error: null,
    loading: false,
    mfaChallenge: 'totp',
    mfaCode: '',
    mfaInputReference: createRef<HTMLInputElement>(),
    onMfaCodeChange: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    onSwitchToRecovery: vi.fn(),
    onSwitchToTotp: vi.fn(),
    ...overrides,
  };
  return { ...render(<MfaView {...props} />), props };
}

describe('MfaView — TOTP challenge', () => {
  it('renders the TOTP heading and input', () => {
    renderView({ mfaChallenge: 'totp' });
    expect(
      screen.getByRole('heading', { name: /two-factor authentication/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/authenticator code/i)).toHaveAttribute(
      'id',
      'mfa-totp-code',
    );
    expect(screen.getByLabelText(/authenticator code/i)).toHaveAttribute(
      'inputmode',
      'numeric',
    );
    expect(screen.getByLabelText(/authenticator code/i)).toHaveAttribute(
      'autocomplete',
      'one-time-code',
    );
  });

  it('offers a switch to recovery mode but not the other direction', () => {
    renderView({ mfaChallenge: 'totp' });
    expect(
      screen.getByRole('button', { name: /use a recovery code/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /use a different method/i }),
    ).not.toBeInTheDocument();
  });

  it('auto-submits when the TOTP code reaches 6 digits', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    renderView({ mfaCode: '123456', onSubmit });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does NOT auto-submit when fewer than 6 digits are entered', () => {
    const onSubmit = vi.fn();
    renderView({ mfaCode: '12345', onSubmit });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does NOT auto-submit when the code contains non-digit characters', () => {
    const onSubmit = vi.fn();
    renderView({ mfaCode: '12345a', onSubmit });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does NOT auto-submit while loading, to avoid re-submitting during the in-flight request', () => {
    const onSubmit = vi.fn();
    renderView({ mfaCode: '123456', loading: true, onSubmit });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('MfaView — recovery challenge', () => {
  it('renders the recovery heading and input with no length cap', () => {
    renderView({ mfaChallenge: 'recovery' });
    expect(
      screen.getByRole('heading', { name: /enter a recovery code/i }),
    ).toBeInTheDocument();
    const input = screen.getByLabelText(/recovery code/i);
    expect(input).toHaveAttribute('id', 'mfa-recovery-code');
    expect(input).not.toHaveAttribute('maxlength');
    expect(input).toHaveAttribute('inputmode', 'text');
    expect(input).toHaveAttribute('autocomplete', 'off');
  });

  it('offers a switch back to a different method', () => {
    renderView({ mfaChallenge: 'recovery' });
    expect(
      screen.getByRole('button', { name: /use a different method/i }),
    ).toBeInTheDocument();
  });

  it('does NOT auto-submit on a 6-digit recovery string — recovery codes are not numeric', () => {
    const onSubmit = vi.fn();
    renderView({
      mfaChallenge: 'recovery',
      mfaCode: '123456',
      onSubmit,
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('MfaView — interactions', () => {
  it('forwards input changes to onMfaCodeChange', () => {
    const onMfaCodeChange = vi.fn();
    renderView({ onMfaCodeChange });
    fireEvent.change(screen.getByLabelText(/authenticator code/i), {
      target: { value: '1' },
    });
    expect(onMfaCodeChange).toHaveBeenCalledWith('1');
  });

  it('renders an alert with role="alert" when error is set', () => {
    renderView({ error: 'Invalid code' });
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid code');
  });

  it('disables the submit button and shows "Verifying…" while loading', () => {
    renderView({ loading: true });
    const button = screen.getByRole('button', { name: /verifying/i });
    expect(button).toBeDisabled();
  });

  it('calls onSwitchToRecovery when the recovery link is clicked', () => {
    const onSwitchToRecovery = vi.fn();
    renderView({ onSwitchToRecovery });
    fireEvent.click(
      screen.getByRole('button', { name: /use a recovery code/i }),
    );
    expect(onSwitchToRecovery).toHaveBeenCalledTimes(1);
  });

  it('calls onSwitchToTotp when the "Use a different method" link is clicked in recovery mode', () => {
    const onSwitchToTotp = vi.fn();
    renderView({ mfaChallenge: 'recovery', onSwitchToTotp });
    fireEvent.click(
      screen.getByRole('button', { name: /use a different method/i }),
    );
    expect(onSwitchToTotp).toHaveBeenCalledTimes(1);
  });
});
