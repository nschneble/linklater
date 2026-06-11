/*
 * Tests for PrimaryButton — the shared primary call-to-action button.
 *
 * Three contracts pinned here:
 * 1. The `surface` prop drives the host-tier paint via the bundle's
 *    highlight slots (`--{surface}-highlight` / `-highlight-fg` /
 *    `-highlight-hover`). PrimaryButton has no intrinsic variants — every
 *    paint is host-driven.
 * 2. The `hidden` prop makes the button non-interactive AND non-announced:
 *    `disabled`, `aria-hidden`, `tabIndex={-1}`, and `pointer-events-none`
 *    must all coexist. Mirrors the IconButton pattern.
 * 3. Default `type="submit"` — differs from IconButton's `type="button"` so
 *    PrimaryButton can be dropped inside a `<form>` without extra wiring.
 *    Guards against an accidental refactor flipping the default.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PrimaryButton from './PrimaryButton';

describe('PrimaryButton', () => {
  it('defaults to mount surface — paints from the mount-highlight bundle slots', () => {
    render(<PrimaryButton>save</PrimaryButton>);
    const button = screen.getByRole('button', { name: 'save' });
    expect(button.getAttribute('data-surface')).toBe('mount');
    expect(button.className).toContain('bg-[var(--mount-highlight)]');
    expect(button.className).toContain('text-[var(--mount-highlight-fg)]');
    expect(button.className).toContain(
      'hover:bg-[var(--mount-highlight-hover)]',
    );
  });

  it('surface="base" paints from the base-highlight bundle slots', () => {
    render(<PrimaryButton surface="base">save</PrimaryButton>);
    const button = screen.getByRole('button', { name: 'save' });
    expect(button.getAttribute('data-surface')).toBe('base');
    expect(button.className).toContain('bg-[var(--base-highlight)]');
    expect(button.className).toContain('text-[var(--base-highlight-fg)]');
    expect(button.className).toContain(
      'hover:bg-[var(--base-highlight-hover)]',
    );
  });

  it('surface="orbit" paints from the orbit-highlight bundle slots', () => {
    render(<PrimaryButton surface="orbit">save</PrimaryButton>);
    const button = screen.getByRole('button', { name: 'save' });
    expect(button.getAttribute('data-surface')).toBe('orbit');
    expect(button.className).toContain('bg-[var(--orbit-highlight)]');
    expect(button.className).toContain('text-[var(--orbit-highlight-fg)]');
    expect(button.className).toContain(
      'hover:bg-[var(--orbit-highlight-hover)]',
    );
  });

  it('hidden=true seals AT exposure: disabled, aria-hidden, tabIndex=-1, pointer-events-none', () => {
    render(<PrimaryButton hidden>secret</PrimaryButton>);
    const button = screen.getByRole('button', { hidden: true });
    expect(button).toBeDisabled();
    expect(button.getAttribute('aria-hidden')).toBe('true');
    expect(button.getAttribute('tabIndex')).toBe('-1');
    expect(button.className).toContain('pointer-events-none');
    expect(button.className).toContain('opacity-0');
  });

  it('hidden=true suppresses the disabled:opacity-60 rule so opacity-0 wins specificity', () => {
    render(<PrimaryButton hidden>secret</PrimaryButton>);
    const button = screen.getByRole('button', { hidden: true });
    // DISABLED applies disabled:opacity-60 — must be ABSENT when hidden
    expect(button.className).not.toContain('disabled:opacity-60');
  });

  it('disabled (but not hidden) keeps the DISABLED utility on the className', () => {
    render(<PrimaryButton disabled>blocked</PrimaryButton>);
    const button = screen.getByRole('button', { name: 'blocked' });
    expect(button).toBeDisabled();
    expect(button.getAttribute('aria-hidden')).toBe(null);
    expect(button.className).toContain('disabled:opacity-60');
  });

  it('hidden=false leaves the button focusable and announced', () => {
    render(<PrimaryButton hidden={false}>visible</PrimaryButton>);
    const button = screen.getByRole('button', { name: 'visible' });
    expect(button.getAttribute('aria-hidden')).toBe(null);
    expect(button.className).toContain('opacity-100');
  });

  it('defaults to type="submit" — drops inside a <form> without extra wiring', () => {
    // Differs from IconButton/LinkButton which default to type="button".
    // A refactor accidentally flipping this default would silently break
    // every <form> consumer.
    render(<PrimaryButton>send</PrimaryButton>);
    expect(
      screen.getByRole('button', { name: 'send' }).getAttribute('type'),
    ).toBe('submit');
  });

  it('does not reference legacy --accent tokens (wave-42 migration anti-regression)', () => {
    // Sister assertion to LinkButton.test.tsx:65. The wave-42 migration
    // moved PrimaryButton off the flat `--accent` / `--accent-fg` /
    // `--accent-hover` tokens onto the bundle highlight slots.
    const { rerender } = render(<PrimaryButton>save</PrimaryButton>);
    let button = screen.getByRole('button', { name: 'save' });
    expect(button.className).not.toContain('var(--accent)');
    expect(button.className).not.toContain('var(--accent-fg)');
    expect(button.className).not.toContain('var(--accent-hover)');

    rerender(<PrimaryButton surface="base">save</PrimaryButton>);
    button = screen.getByRole('button', { name: 'save' });
    expect(button.className).not.toContain('var(--accent)');

    rerender(<PrimaryButton surface="orbit">save</PrimaryButton>);
    button = screen.getByRole('button', { name: 'save' });
    expect(button.className).not.toContain('var(--accent)');
  });

  it('forwards onClick and arbitrary native attributes', () => {
    const handleClick = vi.fn();
    render(
      <PrimaryButton
        onClick={handleClick}
        data-testid="my-button"
        type="button"
      >
        click me
      </PrimaryButton>,
    );
    const button = screen.getByRole('button', { name: 'click me' });
    expect(button.getAttribute('data-testid')).toBe('my-button');
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
