/*
 * Tests for IconButton — the shared small-pill action button.
 *
 * Three contracts pinned here:
 * 1. The `surface` prop drives the host-tier paint for `default`, `ghost`,
 *    and `elevated` variants. Intrinsic variants (`danger`, `danger-filled`)
 *    paint the alert bundle regardless of host.
 * 2. The `hidden` prop makes the button non-interactive AND non-announced:
 *    `disabled`, `aria-hidden`, `tabIndex={-1}`, and `pointer-events-none`
 *    must all coexist so screen readers + keyboard nav + pointer interactions
 *    all ignore the invisible affordance. A regression on any one of those
 *    flags would re-leak the hidden button.
 * 3. The disabled `:opacity-60` rule is suppressed when hidden so the
 *    `opacity-0` visibility class wins specificity (commented in source).
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import IconButton from './IconButton';

describe('IconButton', () => {
  it('defaults to mount surface — default variant paints from the mount bundle', () => {
    render(<IconButton>label</IconButton>);
    const button = screen.getByRole('button', { name: 'label' });
    expect(button.getAttribute('data-surface')).toBe('mount');
    expect(button.className).toContain('ring-[var(--mount-border)]');
    expect(button.className).toContain('text-[var(--mount-text)]');
    expect(button.className).toContain('hover:bg-[var(--orbit-bg)]');
  });

  it('surface="base" lifts the default-variant hover-bg from base → mount', () => {
    render(<IconButton surface="base">label</IconButton>);
    const button = screen.getByRole('button', { name: 'label' });
    expect(button.getAttribute('data-surface')).toBe('base');
    expect(button.className).toContain('ring-[var(--base-border)]');
    expect(button.className).toContain('text-[var(--base-text)]');
    expect(button.className).toContain('hover:bg-[var(--mount-bg)]');
  });

  it('surface="orbit" carries no hover-bg on default — no over-orbit slot exists', () => {
    render(<IconButton surface="orbit">label</IconButton>);
    const button = screen.getByRole('button', { name: 'label' });
    expect(button.getAttribute('data-surface')).toBe('orbit');
    expect(button.className).toContain('ring-[var(--orbit-border)]');
    expect(button.className).toContain('text-[var(--orbit-text)]');
    expect(button.className).not.toContain('hover:bg-[var(--');
  });

  it('ghost variant reads the host bundle alt-text slot (mount default)', () => {
    render(<IconButton variant="ghost">cancel</IconButton>);
    const button = screen.getByRole('button', { name: 'cancel' });
    expect(button.className).toContain('text-[var(--mount-alt-text)]');
    expect(button.className).toContain('ring-[var(--mount-border)]');
  });

  it('ghost variant on base host reads the base bundle alt-text slot', () => {
    render(
      <IconButton variant="ghost" surface="base">
        cancel
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'cancel' });
    expect(button.className).toContain('text-[var(--base-alt-text)]');
    expect(button.className).toContain('ring-[var(--base-border)]');
  });

  it('danger variant is intrinsic — alert tokens regardless of surface', () => {
    const { rerender } = render(
      <IconButton variant="danger" surface="base">
        delete
      </IconButton>,
    );
    let button = screen.getByRole('button', { name: 'delete' });
    expect(button.className).toContain('text-[var(--alert-text)]');
    expect(button.className).toContain('ring-[var(--alert-border)]');
    expect(button.className).toContain('hover:bg-[var(--alert-bg)]');

    rerender(
      <IconButton variant="danger" surface="orbit">
        delete
      </IconButton>,
    );
    button = screen.getByRole('button', { name: 'delete' });
    expect(button.className).toContain('text-[var(--alert-text)]');
    expect(button.className).toContain('ring-[var(--alert-border)]');
  });

  it('danger-filled variant is intrinsic — alert-highlight regardless of surface', () => {
    const { rerender } = render(
      <IconButton variant="danger-filled" surface="mount">
        confirm
      </IconButton>,
    );
    let button = screen.getByRole('button', { name: 'confirm' });
    expect(button.className).toContain('bg-[var(--alert-highlight)]');
    expect(button.className).toContain('text-[var(--alert-highlight-fg)]');
    expect(button.className).toContain(
      'hover:bg-[var(--alert-highlight-hover)]',
    );

    rerender(
      <IconButton variant="danger-filled" surface="base">
        confirm
      </IconButton>,
    );
    button = screen.getByRole('button', { name: 'confirm' });
    expect(button.className).toContain('bg-[var(--alert-highlight)]');
    expect(button.className).toContain('text-[var(--alert-highlight-fg)]');

    rerender(
      <IconButton variant="danger-filled" surface="orbit">
        confirm
      </IconButton>,
    );
    button = screen.getByRole('button', { name: 'confirm' });
    expect(button.className).toContain('bg-[var(--alert-highlight)]');
    expect(button.className).toContain('text-[var(--alert-highlight-fg)]');
  });

  it('default variant carries the universal --focus-ring', () => {
    render(<IconButton>label</IconButton>);
    const button = screen.getByRole('button', { name: 'label' });
    expect(button.className).toContain(
      'focus-visible:ring-[var(--focus-ring)]',
    );
  });

  it('ghost variant carries the universal --focus-ring', () => {
    render(<IconButton variant="ghost">cancel</IconButton>);
    const button = screen.getByRole('button', { name: 'cancel' });
    expect(button.className).toContain(
      'focus-visible:ring-[var(--focus-ring)]',
    );
  });

  it('elevated variant uses the border-shadow focus indicator (not ring)', () => {
    // elevated carries its own card-shadow border affordance for focus
    // instead of the FOCUS_RING utility — visual hierarchy choice.
    render(<IconButton variant="elevated">go</IconButton>);
    const button = screen.getByRole('button', { name: 'go' });
    expect(button.className).toContain('border-shadow');
    expect(button.className).not.toContain(
      'focus-visible:ring-[var(--focus-ring)]',
    );
  });

  it('danger variant carries the alert-highlight focus-ring (FOCUS_RING_DANGER)', () => {
    render(<IconButton variant="danger">delete</IconButton>);
    const button = screen.getByRole('button', { name: 'delete' });
    expect(button.className).toContain(
      'focus-visible:ring-[var(--alert-highlight)]',
    );
    expect(button.className).not.toContain(
      'focus-visible:ring-[var(--focus-ring)]',
    );
  });

  it('danger-filled variant carries the alert-highlight-fg focus-ring (Recovery A)', () => {
    // The danger-filled fill IS --alert-highlight; a same-color ring
    // would paint 1:1 invisible against the variant's own background.
    // Recovery A switches the ring to --alert-highlight-fg, which
    // inherits 4.5:1 vs --alert-highlight from the bundle contract.
    render(<IconButton variant="danger-filled">confirm</IconButton>);
    const button = screen.getByRole('button', { name: 'confirm' });
    expect(button.className).toContain(
      'focus-visible:ring-[var(--alert-highlight-fg)]',
    );
    expect(button.className).not.toContain(
      'focus-visible:ring-[var(--focus-ring)]',
    );
  });

  it('elevated variant on mount host lifts to orbit bg + mount on hover', () => {
    render(<IconButton variant="elevated">go</IconButton>);
    const button = screen.getByRole('button', { name: 'go' });
    expect(button.className).toContain('bg-[var(--orbit-bg)]');
    expect(button.className).toContain('hover:bg-[var(--mount-bg)]');
    expect(button.className).toContain('text-[var(--orbit-text)]');
  });

  it('elevated variant on base host lifts to mount bg + orbit on hover', () => {
    render(
      <IconButton variant="elevated" surface="base">
        go
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'go' });
    expect(button.className).toContain('bg-[var(--mount-bg)]');
    expect(button.className).toContain('hover:bg-[var(--orbit-bg)]');
    expect(button.className).toContain('text-[var(--mount-text)]');
  });

  it('hidden=true seals AT exposure: disabled, aria-hidden, tabIndex=-1, pointer-events-none', () => {
    render(<IconButton hidden>secret</IconButton>);
    const button = screen.getByRole('button', { hidden: true });
    expect(button).toBeDisabled();
    expect(button.getAttribute('aria-hidden')).toBe('true');
    expect(button.getAttribute('tabIndex')).toBe('-1');
    expect(button.className).toContain('pointer-events-none');
    expect(button.className).toContain('opacity-0');
  });

  it('hidden=true suppresses the disabled:opacity-60 rule so opacity-0 wins specificity', () => {
    render(<IconButton hidden>secret</IconButton>);
    const button = screen.getByRole('button', { hidden: true });
    // DISABLED applies disabled:opacity-60 — must be ABSENT when hidden
    expect(button.className).not.toContain('disabled:opacity-60');
  });

  it('disabled (but not hidden) keeps the DISABLED utility on the className', () => {
    render(<IconButton disabled>blocked</IconButton>);
    const button = screen.getByRole('button', { name: 'blocked' });
    expect(button).toBeDisabled();
    expect(button.getAttribute('aria-hidden')).toBe(null);
    expect(button.className).toContain('disabled:opacity-60');
  });

  it('hidden=false leaves the button focusable and announced', () => {
    render(<IconButton hidden={false}>visible</IconButton>);
    const button = screen.getByRole('button', { name: 'visible' });
    expect(button.getAttribute('aria-hidden')).toBe(null);
    expect(button.className).toContain('opacity-100');
  });

  it('forwards onClick and arbitrary native attributes', () => {
    const handleClick = vi.fn();
    render(
      <IconButton onClick={handleClick} data-testid="my-button">
        click me
      </IconButton>,
    );
    const button = screen.getByRole('button', { name: 'click me' });
    expect(button.getAttribute('data-testid')).toBe('my-button');
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('default type is button — guards against accidental form submission', () => {
    render(<IconButton>safe</IconButton>);
    expect(
      screen.getByRole('button', { name: 'safe' }).getAttribute('type'),
    ).toBe('button');
  });
});
