/*
 * Tests for RandomizeButton, the theme editor's "Stumble for colors". The die
 * rolls on each activation (PRD point 12) via a CSS one-shot replayed by
 * remounting the icon, so it inherits the reduced-motion clamp. We assert the
 * mechanism; the die stays aria-hidden so the spin carries no semantic load.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import RandomizeButton from './RandomizeButton';

function getDie() {
  return screen.getByTestId('randomize-die');
}

describe('RandomizeButton – accessible shape', () => {
  it('exposes a button named "Randomize" with a decorative, aria-hidden die', () => {
    render(<RandomizeButton onRandomize={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Randomize' });
    expect(button).toBeInTheDocument();
    expect(getDie()).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('RandomizeButton – dice roll (PRD point 12)', () => {
  it('does not spin before any activation', () => {
    render(<RandomizeButton onRandomize={vi.fn()} />);
    expect(getDie()).not.toHaveClass('animate-dice-roll');
  });

  it('adds the CSS-driven roll class on click (keyboard Enter/Space share this onClick path)', () => {
    render(<RandomizeButton onRandomize={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Randomize' }));
    expect(getDie()).toHaveClass('animate-dice-roll');
  });

  it('still fires onRandomize alongside the roll (spin is not the sole feedback)', () => {
    const onRandomize = vi.fn();
    render(<RandomizeButton onRandomize={onRandomize} />);
    fireEvent.click(screen.getByRole('button', { name: 'Randomize' }));
    expect(onRandomize).toHaveBeenCalledTimes(1);
  });

  it('remounts the die so the one-shot roll replays on every click', () => {
    render(<RandomizeButton onRandomize={vi.fn()} />);
    const button = screen.getByRole('button', { name: 'Randomize' });
    fireEvent.click(button);
    const dieAfterFirst = getDie();
    fireEvent.click(button);
    // key bump remounts the icon so the animation restarts from frame zero
    expect(getDie()).not.toBe(dieAfterFirst);
    expect(getDie()).toHaveClass('animate-dice-roll');
  });
});
