import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import RecoveryCodesPanel from './RecoveryCodesPanel';

const SAMPLE_CODES = [
  'aaaaa-bbbbb-ccccc',
  'ddddd-eeeee-fffff',
  'ggggg-hhhhh-iiiii',
];

describe('RecoveryCodesPanel', () => {
  beforeEach(() => {
    // jsdom doesn't ship a clipboard implementation; stub one.
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('labels the panel with the generated heading', () => {
    render(<RecoveryCodesPanel codes={SAMPLE_CODES} onConfirm={vi.fn()} />);
    const panel = screen.getByLabelText(
      /your recovery codes have been generated/i,
    );
    expect(panel).toBeInTheDocument();
  });

  it('lists each provided recovery code', () => {
    render(<RecoveryCodesPanel codes={SAMPLE_CODES} onConfirm={vi.fn()} />);
    for (const code of SAMPLE_CODES) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }
  });

  it('copies all codes joined by newlines when Copy is clicked', async () => {
    render(<RecoveryCodesPanel codes={SAMPLE_CODES} onConfirm={vi.fn()} />);
    fireEvent.click(
      screen.getByRole('button', {
        name: /copy all recovery codes to clipboard/i,
      }),
    );
    // Wait a microtask for the async clipboard write to settle.
    await Promise.resolve();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      SAMPLE_CODES.join('\n'),
    );
  });

  it('announces "Recovery codes copied to clipboard" after a successful copy', async () => {
    render(<RecoveryCodesPanel codes={SAMPLE_CODES} onConfirm={vi.fn()} />);
    fireEvent.click(
      screen.getByRole('button', {
        name: /copy all recovery codes to clipboard/i,
      }),
    );
    await Promise.resolve();
    expect(
      await screen.findByText(/recovery codes copied to clipboard/i),
    ).toBeInTheDocument();
  });

  it('flips the copy button to the copied state after a successful copy', async () => {
    render(<RecoveryCodesPanel codes={SAMPLE_CODES} onConfirm={vi.fn()} />);
    const button = screen.getByRole('button', {
      name: /copy all recovery codes to clipboard/i,
    });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(button).toHaveAttribute('data-copied', 'true');
  });

  it('moves focus to the panel container on mount', () => {
    render(<RecoveryCodesPanel codes={SAMPLE_CODES} onConfirm={vi.fn()} />);
    const panel = screen.getByLabelText(
      /your recovery codes have been generated/i,
    );
    expect(document.activeElement).toBe(panel);
  });

  it('does not render as a dialog', () => {
    render(<RecoveryCodesPanel codes={SAMPLE_CODES} onConfirm={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
