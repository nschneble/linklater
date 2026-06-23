/*
 * Tests for CopyFromTheme – the two-step "Copy palette from theme" control.
 *
 * Covers a11y brief B2/B6: the themed picker stages a pending choice while an
 * explicit Copy button commits (overwrite never wired to selection), the
 * role="group" labelling, the picker's visible label (via aria-labelledby),
 * the destructive-action describedby, custom-only aria-disabled, and that Copy
 * reads tokens from a probe element's computed style for BOTH modes.
 */

import CopyFromTheme from './CopyFromTheme';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_TOKEN_KEYS } from '../../../theme/customTheme';

function renderControl(isCustom = true) {
  const onCopy = vi.fn();
  render(<CopyFromTheme isCustom={isCustom} onCopy={onCopy} />);
  return { onCopy };
}

function getTrigger() {
  return screen.getByRole('combobox', { name: /copy palette from theme/i });
}

function getCopyButton() {
  return screen.getByRole('button', { name: /^copy$/i });
}

/** Opens the picker and clicks the option with the given accessible name. */
function selectTheme(name: RegExp) {
  fireEvent.click(getTrigger());
  const listbox = screen.getByRole('listbox', {
    name: /copy palette from theme/i,
  });
  fireEvent.click(within(listbox).getByRole('option', { name }));
}

// jsdom does not apply the [data-theme] stylesheet cascade, so stub
// getComputedStyle to return a fixed token value for every custom key. This
// lets us assert the probe was queried per mode without a real stylesheet.
const realGetComputedStyle = window.getComputedStyle;

beforeEach(() => {
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const dataset = (element as HTMLElement).dataset;
    return {
      getPropertyValue: (property: string) =>
        CUSTOM_TOKEN_KEYS.includes(property)
          ? `value-${dataset.theme}-${dataset.mode}`
          : '',
    } as unknown as CSSStyleDeclaration;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  window.getComputedStyle = realGetComputedStyle;
});

describe('CopyFromTheme', () => {
  it('groups the picker and button under a labelled group', () => {
    renderControl();
    expect(
      screen.getByRole('group', { name: /copy palette from theme/i }),
    ).toBeInTheDocument();
  });

  it('does NOT copy on selection (two-step, SC 3.2.2)', () => {
    const { onCopy } = renderControl();
    selectTheme(/apollo 10½/i);
    expect(onCopy).not.toHaveBeenCalled();
  });

  it('copies BOTH modes resolved from the probe on Copy click', () => {
    const { onCopy } = renderControl();
    selectTheme(/apollo 10½/i);
    fireEvent.click(getCopyButton());

    expect(onCopy).toHaveBeenCalledTimes(1);
    const [tokens, label] = onCopy.mock.calls[0];
    expect(label).toBe('Apollo 10½');
    expect(tokens.dark['--mount-bg']).toBe('value-apollo-10-1-2-dark');
    expect(tokens.light['--mount-bg']).toBe('value-apollo-10-1-2-light');
    expect(Object.keys(tokens.dark).length).toBe(CUSTOM_TOKEN_KEYS.length);
  });

  it('stays disabled until a theme is selected', () => {
    const { onCopy } = renderControl();
    const button = getCopyButton();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(button);
    expect(onCopy).not.toHaveBeenCalled();
  });

  it('excludes the custom theme from the copyable options', () => {
    renderControl();
    fireEvent.click(getTrigger());
    expect(screen.queryByRole('option', { name: /^custom$/i })).toBeNull();
  });

  it('is present but aria-disabled for non-custom themes (B6)', () => {
    const { onCopy } = renderControl(false);
    const button = getCopyButton();
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    selectTheme(/apollo 10½/i);
    fireEvent.click(button);
    expect(onCopy).not.toHaveBeenCalled();
  });

  it('warns that copying replaces edits via aria-describedby', () => {
    renderControl();
    const button = getCopyButton();
    const describedById = button.getAttribute('aria-describedby');
    const description = document.getElementById(describedById as string);
    expect(description?.textContent).toMatch(/replaces all current edits/i);
  });
});
