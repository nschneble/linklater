import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import RecoveryCodesModal from './RecoveryCodesModal';

const SAMPLE_CODES = [
  'aaaaa-bbbbb-ccccc',
  'ddddd-eeeee-fffff',
  'ggggg-hhhhh-iiiii',
];

describe('RecoveryCodesModal', () => {
  beforeEach(() => {
    // jsdom doesn't ship a clipboard implementation; stub one.
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders as a labelled modal dialog', () => {
    render(<RecoveryCodesModal codes={SAMPLE_CODES} onConfirm={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/save your recovery codes/i);
  });

  it('lists each provided recovery code', () => {
    render(<RecoveryCodesModal codes={SAMPLE_CODES} onConfirm={vi.fn()} />);
    for (const code of SAMPLE_CODES) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }
  });

  it('copies all codes joined by newlines when Copy is clicked', async () => {
    render(<RecoveryCodesModal codes={SAMPLE_CODES} onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /copy all codes/i }));
    // Wait a microtask for the async clipboard write to settle.
    await Promise.resolve();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      SAMPLE_CODES.join('\n'),
    );
  });

  it('flips the copy button label to "Copied!" after a successful copy', async () => {
    render(<RecoveryCodesModal codes={SAMPLE_CODES} onConfirm={vi.fn()} />);
    const button = screen.getByRole('button', { name: /copy all codes/i });
    fireEvent.click(button);
    await Promise.resolve();
    expect(
      await screen.findByRole('button', { name: /copied/i }),
    ).toBeInTheDocument();
  });

  it('calls onConfirm when the "I\'ve saved these codes" button is clicked', () => {
    const onConfirm = vi.fn();
    render(<RecoveryCodesModal codes={SAMPLE_CODES} onConfirm={onConfirm} />);
    fireEvent.click(
      screen.getByRole('button', { name: /i've saved these codes/i }),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when Escape is pressed (treating it as confirmation)', () => {
    const onConfirm = vi.fn();
    render(<RecoveryCodesModal codes={SAMPLE_CODES} onConfirm={onConfirm} />);
    // useFocusTrap listens on the dialog ref; dispatch the keydown there.
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('restores focus to the previously focused element when the modal unmounts', () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'Open';
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <RecoveryCodesModal codes={SAMPLE_CODES} onConfirm={vi.fn()} />,
    );
    unmount();

    expect(document.activeElement).toBe(trigger);
    trigger.remove();
  });
});
