import TokenInput from './TokenInput';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';

function Wrapper({ initialValue = '' }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <TokenInput value={value} onChange={setValue} />;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TokenInput', () => {
  it('renders a labeled password input that masks the token by default', () => {
    render(<Wrapper />);
    const input = screen.getByLabelText(/personal access token/i);
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
  });

  it('does not announce a validation error while typing', () => {
    render(<Wrapper />);
    const input = screen.getByLabelText(/personal access token/i);
    fireEvent.change(input, { target: { value: 'oops' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('announces the validation error on blur when the prefix is wrong', () => {
    render(<Wrapper />);
    const input = screen.getByLabelText(/personal access token/i);
    fireEvent.change(input, { target: { value: 'oops' } });
    fireEvent.blur(input);
    expect(screen.getByRole('alert')).toHaveTextContent(/ltk_/i);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not flag a valid ltk_-prefixed token as invalid', () => {
    render(<Wrapper />);
    const input = screen.getByLabelText(/personal access token/i);
    fireEvent.change(input, { target: { value: 'ltk_abcd1234' } });
    fireEvent.blur(input);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('toggles the show/hide button via aria-pressed', () => {
    render(<Wrapper initialValue="ltk_secret123" />);
    const button = screen.getByRole('button', { name: /show token/i });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(button);
    const updated = screen.getByRole('button', { name: /hide token/i });
    expect(updated).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText(/personal access token/i)).toHaveAttribute(
      'type',
      'text',
    );
  });

  it('clears the input when Clear is clicked and announces it', () => {
    render(<Wrapper initialValue="ltk_secret123" />);
    const clear = screen.getByRole('button', { name: /^clear$/i });
    fireEvent.click(clear);
    const input = screen.getByLabelText(
      /personal access token/i,
    ) as HTMLInputElement;
    expect(input.value).toBe('');
    expect(screen.getByRole('status')).toHaveTextContent(/token cleared/i);
  });
});
