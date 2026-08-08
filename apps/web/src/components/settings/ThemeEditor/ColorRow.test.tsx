/*
 * Tests for the bundle slot row (`ColorRow`).
 *
 * A row puts a value it cannot read back to the prior one on blur and
 * commits nothing, and reports the refusal instead of swallowing it.
 * Both halves are pinned: the revert, so a partial commit cannot creep
 * in, and the message, so the silent version cannot come back. That
 * silent version shipped, unnoticed while everything it turned away was
 * true garbage.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ColorRow, {
  buildSwatchStyle,
  FAILURE_NOTE_DEBOUNCE_MS,
  REFUSED_VALUE_MESSAGE,
} from './ColorRow';
import type { TokenContrastFailure } from './contrastResults.notes';

function renderRow(currentValue = '#123456') {
  const onOverride = vi.fn();
  render(
    <ColorRow
      label="Background"
      variable="--mount-bg"
      currentValue={currentValue}
      failure={undefined}
      onOverride={onOverride}
    />,
  );
  const input = screen.getByLabelText(
    'Value for Background',
  ) as HTMLInputElement;
  return { onOverride, input };
}

/** A realistic worst-failing pair: card text on a too-light card background. */
function makeFailure(
  overrides: Partial<TokenContrastFailure> = {},
): TokenContrastFailure {
  return {
    ratio: 2.8,
    threshold: 4.5,
    noteSubject: 'Text contrast',
    ...overrides,
  };
}

function rowWith(failure: TokenContrastFailure | undefined) {
  return (
    <ColorRow
      label="Background"
      variable="--mount-bg"
      currentValue="#cccccc"
      failure={failure}
      onOverride={vi.fn()}
    />
  );
}

describe('ColorRow – slot-only accessible names (SC 2.4.6 de-dupe)', () => {
  it('names the picker + hex by slot alone, no bundle prefix', () => {
    renderRow();
    // tabpanel sets the bundle, so names are slot-only, never "Mount background"
    expect(
      screen.getByLabelText('Color picker for Background'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Value for Background')).toBeInTheDocument();
    expect(screen.queryByLabelText(/mount background/i)).toBeNull();
  });
});

describe('ColorRow – reverting a refused value, and saying so', () => {
  it('resets the typed value to currentValue on blur and commits nothing', () => {
    const { onOverride, input } = renderRow('#123456');

    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.blur(input);

    // reverted to the prior value, no kept text
    expect(input.value).toBe('#123456');
    expect(onOverride).not.toHaveBeenCalled();
  });

  it('names the refusal in an alert the input points at', () => {
    // the revert alone erases the typed text and explains nothing, and
    // the values it turns away are no longer all garbage: tightening the
    // checker moved real CSS colors onto this path (SC 3.3.1, SC 3.3.3)
    const { input } = renderRow('#123456');

    fireEvent.change(input, { target: { value: 'rgb(0%, 50%, 100%)' } });
    fireEvent.blur(input);

    const refusal = screen.getByRole('alert');
    expect(refusal).toHaveTextContent(REFUSED_VALUE_MESSAGE);
    // aria-errormessage is only exposed on a field flagged invalid
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-errormessage')).toBe(
      refusal.getAttribute('id'),
    );
  });

  it('suggests a shape that works, not just that the value failed', () => {
    // SC 3.3.3 wants the correction, and the accepted set is narrower
    // than what CSS itself takes
    expect(REFUSED_VALUE_MESSAGE).toMatch(/#[0-9a-f]{6}/);
  });

  it('clears the refusal as soon as the user types again', () => {
    const { input } = renderRow('#123456');

    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: '#abc' } });

    expect(screen.queryByRole('alert')).toBeNull();
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('commits a valid hex (normalized) on blur', () => {
    const { onOverride, input } = renderRow('#123456');

    // 3-digit shorthand normalizes to 6-digit on commit.
    fireEvent.change(input, { target: { value: '#abc' } });
    fireEvent.blur(input);

    expect(input.value).toBe('#aabbcc');
    expect(onOverride).toHaveBeenCalledWith('--mount-bg', '#aabbcc');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('accepts a #-less hex on blur, prepending the # (Postel’s Law)', () => {
    const { onOverride, input } = renderRow('#123456');

    fireEvent.change(input, { target: { value: 'aabbcc' } });
    fireEvent.blur(input);

    // normalized, committed, and kept in the input (not reverted); the # is added
    expect(input.value).toBe('#aabbcc');
    expect(onOverride).toHaveBeenCalledWith('--mount-bg', '#aabbcc');
  });

  it('reverts true garbage on blur and commits nothing', () => {
    const { onOverride, input } = renderRow('#123456');

    fireEvent.change(input, { target: { value: 'zzz' } });
    fireEvent.blur(input);

    expect(input.value).toBe('#123456');
    expect(onOverride).not.toHaveBeenCalled();
  });
});

// the flag, the note and its describedby all wait out the same debounce
describe('ColorRow – inline contrast-failure note', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds aria-invalid to the same debounce as the note it needs', () => {
    // the flag used to lead the note by the debounce, so for that
    // window the field announced itself invalid with nothing saying
    // why, on a value still being typed. announcing nothing is the
    // better half-second
    const { rerender } = render(rowWith(undefined));
    const input = screen.getByLabelText(
      'Value for Background',
    ) as HTMLInputElement;
    expect(input).not.toHaveAttribute('aria-invalid');

    rerender(rowWith(makeFailure()));

    // nothing has flipped yet: no flag, no note, no describedby
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText(/contrast is too low/i)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(FAILURE_NOTE_DEBOUNCE_MS);
    });

    expect(input).toHaveAttribute('aria-invalid', 'true');
    // matches ColorRow's format: partner slot label plus the ratio to one decimal
    const note = screen.getByText('Text contrast is too low (2.8:1)');
    expect(note).toBeInTheDocument();
    // describedby now resolves to the rendered note's id.
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBe('theme-editor-failure-mount-bg');
    expect(note).toHaveAttribute('id', describedBy as string);
  });

  it('shows no invalid flag and no note when failure is undefined', () => {
    const { input } = renderRow('#123456');

    act(() => {
      vi.advanceTimersByTime(FAILURE_NOTE_DEBOUNCE_MS);
    });

    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText(/fails contrast/i)).not.toBeInTheDocument();
  });
});

// alpha has no native <input type="color">, so the picker is off, hex stays editable
describe('ColorRow – alpha disables the picker, keeps the text input editable', () => {
  it('disables the color picker for an rgba() value', () => {
    render(
      <ColorRow
        label="Background"
        variable="--alert-bg"
        currentValue="rgb(76 5 25 / 0.4)"
        failure={undefined}
        onOverride={vi.fn()}
      />,
    );

    const picker = screen.getByLabelText(
      'Color picker for Background',
    ) as HTMLInputElement;
    const text = screen.getByLabelText(
      'Value for Background',
    ) as HTMLInputElement;

    expect(picker).toBeDisabled();
    expect(text).not.toBeDisabled();
  });

  it('disables the color picker for an 8-digit (alpha) hex value', () => {
    render(
      <ColorRow
        label="Background"
        variable="--alert-bg"
        currentValue="#00000080"
        failure={undefined}
        onOverride={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Color picker for Background')).toBeDisabled();
    expect(screen.getByLabelText('Value for Background')).not.toBeDisabled();
  });

  it('disables the color picker for a 4-digit (alpha) hex value', () => {
    // the shorthand doubles each digit into the long form, so it carries
    // alpha too. read as opaque, the picker stayed live on a value it
    // cannot hold, and a keyboard user activating it would have written
    // over the token. the swatch reads from the same answer, so it was
    // painting the fallback too; jsdom drops the layered background, so
    // that half is pinned on the helper instead
    render(
      <ColorRow
        label="Background"
        variable="--alert-bg"
        currentValue="#abcd"
        failure={undefined}
        onOverride={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Color picker for Background')).toBeDisabled();
    expect(screen.getByLabelText('Value for Background')).not.toBeDisabled();
  });
});

// color layer goes first in background-image so opaque values occlude the checker
describe('ColorRow – swatch shows transparency over a checkerboard', () => {
  function getSwatch(currentValue: string): HTMLElement {
    render(
      <ColorRow
        label="Background"
        variable="--alert-bg"
        currentValue={currentValue}
        failure={undefined}
        onOverride={vi.fn()}
      />,
    );
    const picker = screen.getByLabelText('Color picker for Background');
    const swatch = picker.closest('label')?.querySelector('span');
    if (!swatch) {
      throw new Error('swatch span not found');
    }
    return swatch as HTMLElement;
  }

  // jsdom's CSSOM drops modern rgb(r g b / a) syntax, so assert off the helper
  it('layers the color over a checkerboard, color first so opaque occludes it', () => {
    const image = String(buildSwatchStyle('#12345680').backgroundImage);
    expect(image).toContain('conic-gradient');
    expect(image).toContain('linear-gradient(#12345680, #12345680)');
    expect(image.indexOf('linear-gradient')).toBeLessThan(
      image.indexOf('conic-gradient'),
    );
  });

  it('bases the swatch on --mount-input-bg and sizes the checker cells', () => {
    const style = buildSwatchStyle('#12345680');
    expect(style.backgroundColor).toBe('var(--mount-input-bg)');
    expect(style.backgroundSize).toBe('100% 100%, 8px 8px');
  });

  it('keeps a forced-colors border so the swatch survives High Contrast mode', () => {
    // forced-colors strips both bg layers; the CanvasText border keeps the swatch a box
    expect(getSwatch('#12345680').className).toContain(
      'forced-colors:border-[CanvasText]',
    );
  });
});
