/*
 * Tests for the bundle slot row (`ColorRow`).
 *
 * A row SILENTLY reverts an invalid hex to the prior value on blur and commits
 * nothing — no kept text, no error flag. This pins that deliberate quiet-revert
 * behavior so a future "surface a format error" refactor can't add one
 * unnoticed.
 */

import ColorRow, {
  buildSwatchStyle,
  FAILURE_NOTE_DEBOUNCE_MS,
} from './ColorRow';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenContrastFailure } from './contrastResults';

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
    pairLabel: 'text / bg',
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
    // The enclosing tabpanel establishes the bundle, so the row names are
    // slot-only ("...for Background"), never "...for Mount background".
    expect(
      screen.getByLabelText('Color picker for Background'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Value for Background')).toBeInTheDocument();
    expect(screen.queryByLabelText(/mount background/i)).toBeNull();
  });
});

describe('ColorRow – silent invalid-hex revert', () => {
  it('resets the typed value to currentValue on blur and commits nothing', () => {
    const { onOverride, input } = renderRow('#123456');

    fireEvent.change(input, { target: { value: 'nope' } });
    fireEvent.blur(input);

    // Reverted to the prior value — no kept text, no flag.
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

  it('accepts a #-less hex on blur, prepending the # (Postel’s Law)', () => {
    const { onOverride, input } = renderRow('#123456');

    fireEvent.change(input, { target: { value: 'aabbcc' } });
    fireEvent.blur(input);

    // Normalized to a prefixed hex, committed, and KEPT in the input (not
    // reverted) — the missing `#` is added silently.
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

/*
 * The inline contrast-failure note is now the SOLE inline contrast channel
 * (the standalone card + the human knobs that used to carry it are retired), so
 * its contract lives here, on the row that renders it. `aria-invalid` tracks the
 * LIVE failure (un-debounced) so the input border flags immediately; the visible
 * note + its `aria-describedby` wiring are DEBOUNCED so a half-typed value
 * doesn't thrash the announced text (BL1 / C1).
 */
describe('ColorRow – inline contrast-failure note', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('flags aria-invalid immediately but debounces the visible note + describedby', () => {
    // Start clean (passing), then the live edit fails: this is the transition
    // the debounce actually guards — aria-invalid must flip at once while the
    // visible note + describedby wait out the debounce.
    const { rerender } = render(rowWith(undefined));
    const input = screen.getByLabelText(
      'Value for Background',
    ) as HTMLInputElement;
    expect(input).not.toHaveAttribute('aria-invalid');

    rerender(rowWith(makeFailure()));

    // aria-invalid is live: the input border reflects the failing value at once,
    // before the debounce elapses.
    expect(input).toHaveAttribute('aria-invalid', 'true');
    // The visible note + its describedby link wait for the debounce.
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByText(/fails contrast/i)).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(FAILURE_NOTE_DEBOUNCE_MS);
    });

    // The rendered string matches ColorRow's format exactly (ratio to one
    // decimal, threshold as authored).
    const note = screen.getByText(
      'Fails contrast with text / bg — 2.8:1, needs 4.5:1',
    );
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

/*
 * W-1 — the alpha-disabled picker path. An alpha value (rgba()/8-digit hex)
 * can't be represented by a native `<input type="color">`, so the picker is
 * disabled while the hex text input stays editable (the only way to edit alpha).
 */
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
});

/*
 * The swatch preview lays the color over a transparency checkerboard so an
 * alpha value reads as transparent instead of a mystery solid. Opaque values
 * (alpha FF) fully occlude the checker, so the color layer MUST come first in
 * `background-image`. The swatch stays decorative — no role/label; the hex
 * input beside it owns the value — so these assertions target its style/class.
 */
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

  // The style is unit-tested off the helper: jsdom's CSSOM silently drops a
  // modern `rgb(r g b / a)` gradient (real browsers accept it), so asserting
  // through a rendered element's `.style.backgroundImage` is unreliable.
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
    // Both background layers are stripped in forced-colors; the CanvasText
    // border is what keeps the swatch a visible box (per a11y review).
    expect(getSwatch('#12345680').className).toContain(
      'forced-colors:border-[CanvasText]',
    );
  });
});
