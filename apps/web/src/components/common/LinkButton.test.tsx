/*
 * Tests for LinkButton – inline underline-style action button.
 *
 * Pins the surface-prop paint matrix (base / mount / warn) and the focus-ring
 * presence. Hover paint is asserted at the class-string level
 * because JSDOM does not exercise CSS `:hover`.
 */

import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import LinkButton from './LinkButton';

describe('LinkButton', () => {
  it('defaults to mount surface – paints mount-alt-text idle, mount-text hover', () => {
    render(<LinkButton onClick={() => {}}>link</LinkButton>);
    const button = screen.getByRole('button', { name: 'link' });
    expect(button.getAttribute('data-surface')).toBe('mount');
    expect(button.className).toContain('text-[var(--mount-alt-text)]');
    expect(button.className).toContain('hover:text-[var(--mount-text)]');
  });

  it('surface="base" paints base-alt-text idle, base-text hover', () => {
    render(
      <LinkButton surface="base" onClick={() => {}}>
        link
      </LinkButton>,
    );
    const button = screen.getByRole('button', { name: 'link' });
    expect(button.getAttribute('data-surface')).toBe('base');
    expect(button.className).toContain('text-[var(--base-alt-text)]');
    expect(button.className).toContain('hover:text-[var(--base-text)]');
  });

  it('surface="warn" paints warn-text (no idle/hover differentiation – underline carries affordance)', () => {
    render(
      <LinkButton surface="warn" onClick={() => {}}>
        link
      </LinkButton>,
    );
    const button = screen.getByRole('button', { name: 'link' });
    expect(button.getAttribute('data-surface')).toBe('warn');
    expect(button.className).toContain('text-[var(--warn-text)]');
    expect(button.className).not.toContain('hover:text-[var(');
  });

  it('always renders the underline – link affordance does not depend on color', () => {
    render(<LinkButton onClick={() => {}}>link</LinkButton>);
    const button = screen.getByRole('button', { name: 'link' });
    expect(button.className).toContain('underline');
  });

  it('renders a focus-visible ring so keyboard focus is detectable', () => {
    render(<LinkButton onClick={() => {}}>link</LinkButton>);
    const button = screen.getByRole('button', { name: 'link' });
    expect(button.className).toContain('focus-visible:ring-2');
    expect(button.className).toContain(
      'focus-visible:ring-[var(--focus-ring)]',
    );
  });

  it('drops the accent flair on hover – no longer reads --accent', () => {
    render(<LinkButton onClick={() => {}}>link</LinkButton>);
    const button = screen.getByRole('button', { name: 'link' });
    expect(button.className).not.toContain('var(--accent)');
  });

  it('defaults to type="button" – never accidentally submits a parent form', () => {
    render(<LinkButton onClick={() => {}}>link</LinkButton>);
    expect(
      screen.getByRole('button', { name: 'link' }).getAttribute('type'),
    ).toBe('button');
  });

  it('fires onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<LinkButton onClick={handleClick}>link</LinkButton>);
    fireEvent.click(screen.getByRole('button', { name: 'link' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('respects disabled – does not fire onClick + shows disabled style', () => {
    const handleClick = vi.fn();
    render(
      <LinkButton disabled onClick={handleClick}>
        link
      </LinkButton>,
    );
    const button = screen.getByRole('button', { name: 'link' });
    expect(button).toBeDisabled();
    expect(button.className).toContain('disabled:opacity-50');
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('forwards ref to the underlying button – load-bearing for post-action focus on ConfirmAccountDeletionPage', () => {
    const reference = createRef<HTMLButtonElement>();
    render(
      <LinkButton ref={reference} onClick={() => {}}>
        link
      </LinkButton>,
    );
    expect(reference.current).toBeInstanceOf(HTMLButtonElement);
    expect(reference.current?.textContent).toBe('link');
  });

  it('preserves caller className alongside the surface paint', () => {
    render(
      <LinkButton className="custom-marker" onClick={() => {}}>
        link
      </LinkButton>,
    );
    const button = screen.getByRole('button', { name: 'link' });
    expect(button.className).toContain('custom-marker');
    expect(button.className).toContain('text-[var(--mount-alt-text)]');
  });
});
