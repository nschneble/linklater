import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TotpSetupView from './TotpSetupView';

const QR_DATA_URL = 'data:image/png;base64,iVBORw0KGgo=';
const SECRET = 'JBSWY3DPEHPK3PXP';

function renderView(
  overrides: Partial<React.ComponentProps<typeof TotpSetupView>> = {},
) {
  const props: React.ComponentProps<typeof TotpSetupView> = {
    qrCodeDataUrl: QR_DATA_URL,
    secret: SECRET,
    code: '',
    codeInputReference: createRef<HTMLInputElement>(),
    loading: false,
    error: null,
    onCodeChange: vi.fn(),
    onSubmit: vi.fn((event) => event.preventDefault()),
    ...overrides,
  };
  return { ...render(<TotpSetupView {...props} />), props };
}

describe('TotpSetupView', () => {
  it('renders the QR code image with the provided data URL', () => {
    renderView();
    const image = screen.getByRole('img', { name: /totp qr code/i });
    expect(image).toHaveAttribute('src', QR_DATA_URL);
  });

  it('renders the manual entry secret', () => {
    renderView();
    expect(screen.getByText(SECRET)).toBeInTheDocument();
  });

  it('configures the verification input with numeric inputmode, autocomplete, and 6-char cap', () => {
    renderView();
    const input = screen.getByLabelText(/verification code/i);
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).toHaveAttribute('maxlength', '6');
  });

  it('forwards input changes to onCodeChange', () => {
    const onCodeChange = vi.fn();
    renderView({ onCodeChange });
    fireEvent.change(screen.getByLabelText(/verification code/i), {
      target: { value: '1' },
    });
    expect(onCodeChange).toHaveBeenCalledWith('1');
  });

  it('auto-submits when the code reaches 6 digits', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    renderView({ code: '123456', onSubmit });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('does NOT auto-submit when the code is shorter than 6 digits', () => {
    const onSubmit = vi.fn();
    renderView({ code: '12345', onSubmit });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does NOT auto-submit when the code contains non-digit characters', () => {
    const onSubmit = vi.fn();
    renderView({ code: '12345a', onSubmit });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('renders the error alert when error is set', () => {
    renderView({ error: 'Invalid code' });
    expect(screen.getByText('Invalid code')).toBeInTheDocument();
  });

  it('disables the verify button and shows "Verifying…" while loading', () => {
    renderView({ loading: true });
    expect(screen.getByRole('button', { name: /verifying/i })).toBeDisabled();
  });
});
