/*
 * Tests for the demoted token-tree row (`ColorRow`).
 *
 * The drawer rows are the QUIET counterpart to the human knobs: where a knob
 * keeps an invalid hex on screen, flags it, and shows a format error, a drawer
 * row SILENTLY reverts to the prior value on blur and commits nothing. This
 * pins that deliberate divergence so a future "make them consistent" refactor
 * can't erase it unnoticed.
 */

import ColorRow from './ColorRow';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

function renderRow(currentValue = '#123456') {
  const onOverride = vi.fn();
  render(
    <ColorRow
      label="Background"
      bundleLabel="Mount"
      variable="--mount-bg"
      currentValue={currentValue}
      failure={undefined}
      onOverride={onOverride}
    />,
  );
  const input = screen.getByLabelText(
    'Value for Mount background',
  ) as HTMLInputElement;
  return { onOverride, input };
}

describe('ColorRow – silent invalid-hex revert', () => {
  it('resets the typed value to currentValue on blur and commits nothing', () => {
    const { onOverride, input } = renderRow('#123456');

    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.blur(input);

    // Reverted to the prior value — no kept text, no flag (unlike the knobs).
    expect(input.value).toBe('#123456');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(onOverride).not.toHaveBeenCalled();
  });

  it('commits a valid hex (normalized) on blur', () => {
    const { onOverride, input } = renderRow('#123456');

    // 3-digit shorthand normalizes to 6-digit on commit.
    fireEvent.change(input, { target: { value: '#abc' } });
    fireEvent.blur(input);

    expect(input.value).toBe('#aabbcc');
    expect(onOverride).toHaveBeenCalledWith('--mount-bg', '#aabbcc');
  });
});
