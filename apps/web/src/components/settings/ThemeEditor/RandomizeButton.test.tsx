/*
 * Tests for RandomizeButton — the theme editor's "Stumble for colors". The die
 * ROLLS on each activation (PRD point 12), echoing Stumble's spin energy. The
 * roll is a CSS-driven one-shot (`animate-dice-roll`) replayed by remounting the
 * icon, so it inherits the global prefers-reduced-motion clamp; we assert the
 * mechanism (the class appears on click, the icon stays decorative) and trust
 * the clamp for reduced-motion safety. The button name stays "Randomize" and the
 * die stays aria-hidden, so the spin carries zero semantic load.
 */

import RandomizeButton from './RandomizeButton';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
    // The key bump remounts the icon, so React gives us a fresh node and the
    // animation restarts from frame zero rather than diffing in place.
    expect(getDie()).not.toBe(dieAfterFirst);
    expect(getDie()).toHaveClass('animate-dice-roll');
  });
});
