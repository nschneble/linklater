import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import KeyboardShortcutsToggle from './KeyboardShortcutsToggle';
import { KEYBOARD_SHORTCUTS_KEY } from '../../lib/hooks/useShortcutsEnabled';

function renderToggle() {
  return render(
    <MemoryRouter>
      <KeyboardShortcutsToggle />
    </MemoryRouter>,
  );
}

afterEach(() => {
  window.localStorage.clear();
});

describe('KeyboardShortcutsToggle', () => {
  it('renders as a checked switch by default (shortcuts on)', () => {
    renderToggle();
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('On')).toBeInTheDocument();
  });

  it('renders unchecked when the stored preference is off', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'off');
    renderToggle();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('flips aria-checked and persists off when toggled from on', () => {
    renderToggle();
    const toggle = screen.getByRole('switch');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(window.localStorage.getItem(KEYBOARD_SHORTCUTS_KEY)).toBe('off');
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('flips aria-checked and persists on when toggled from off', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'off');
    renderToggle();
    const toggle = screen.getByRole('switch');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(window.localStorage.getItem(KEYBOARD_SHORTCUTS_KEY)).toBe('on');
    expect(screen.getByText('On')).toBeInTheDocument();
  });

  it('exposes the label and description for assistive tech', () => {
    renderToggle();
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-labelledby', 'shortcuts-label');
    expect(toggle).toHaveAttribute('aria-describedby', 'shortcuts-description');
  });
});
