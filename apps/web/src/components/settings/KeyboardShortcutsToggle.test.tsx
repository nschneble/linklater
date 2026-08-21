import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';

import { KEYBOARD_SHORTCUTS_KEY } from '../../lib/hooks/useShortcutsEnabled';
import KeyboardShortcutsToggle from './KeyboardShortcutsToggle';
import { resetShortcutsPreference } from '../../../test/shortcutsPreference';

function renderToggle() {
  return render(
    <MemoryRouter>
      <KeyboardShortcutsToggle />
    </MemoryRouter>,
  );
}

function describedBy(toggle: HTMLElement) {
  const id = toggle.getAttribute('aria-describedby') ?? '';
  const description = document.getElementById(id);
  if (description === null) throw new Error(`no element with id "${id}"`);
  return description;
}

// aria-checked carries the state; a text mirror announces it twice
function expectStateNotRestatedAsText() {
  expect(screen.queryByText(/^(On|Off)$/)).not.toBeInTheDocument();
}

beforeEach(resetShortcutsPreference);

describe('KeyboardShortcutsToggle', () => {
  it('renders as a checked switch by default (shortcuts on)', () => {
    renderToggle();
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expectStateNotRestatedAsText();
  });

  it('renders unchecked when the stored preference is off', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'off');
    renderToggle();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    expectStateNotRestatedAsText();
  });

  it('flips aria-checked and persists off when toggled from on', () => {
    renderToggle();
    const toggle = screen.getByRole('switch');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(window.localStorage.getItem(KEYBOARD_SHORTCUTS_KEY)).toBe('off');
    expectStateNotRestatedAsText();
  });

  it('flips aria-checked and persists on when toggled from off', () => {
    window.localStorage.setItem(KEYBOARD_SHORTCUTS_KEY, 'off');
    renderToggle();
    const toggle = screen.getByRole('switch');

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute('aria-checked', 'true');
    expect(window.localStorage.getItem(KEYBOARD_SHORTCUTS_KEY)).toBe('on');
    expectStateNotRestatedAsText();
  });

  it('exposes the label and description for assistive tech', () => {
    renderToggle();
    const toggle = screen.getByRole('switch');
    expect(toggle).toHaveAttribute('aria-labelledby', 'shortcuts-label');
    expect(toggle).toHaveAttribute('aria-describedby', 'shortcuts-description');
    expect(toggle).toHaveAccessibleName('Keyboard shortcuts');
  });

  it('keeps the description free of controls a description would flatten', () => {
    renderToggle();
    const toggle = screen.getByRole('switch');

    expect(within(describedBy(toggle)).queryByRole('button')).toBeNull();
    expect(toggle).toHaveAccessibleDescription(
      /quick keyboard navigation for many actions on the Your Links page/,
    );
  });

  it('keeps the link to Your Links a real control that still navigates', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<KeyboardShortcutsToggle />} />
          <Route path="/unread" element={<p>Your links</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Go to Your Links' }));

    expect(screen.getByText('Your links')).toBeInTheDocument();
  });
});
