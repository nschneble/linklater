/*
 * Tests for TabButton, a single tab inside a `role="tablist"`.
 *
 * Surface paint is driven structurally: TabButton reads its host bundle
 * from an ancestor's `data-surface` attribute via Tailwind
 * `group-data-[surface=...]` variants. No surface prop exists; the tab
 * stays in lock-step with its parent SlidingTabBar's pill bg.
 *
 * What this file pins:
 * - Default (no parent data-surface, or `data-surface=base`) paints
 *   `--mount-alt-text` idle and `--mount-bg` active.
 * - Under `data-surface=mount`, the variant overrides take effect:
 *   `--orbit-alt-text` idle and `--orbit-bg` active.
 * - `aria-selected` mirrors `isActive`. Roving `tabIndex` (0 when active,
 *   -1 when inactive) is preserved; `useTabNavigation` in the parent
 *   relies on it for arrow-key navigation.
 * - The CVD active-indicator `fa-circle-dot` renders only when active.
 * - The off-screen extrabold sizing twin always renders so the label does
 *   not jump width when font-weight changes between idle and active.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import TabButton from './TabButton';

describe('TabButton', () => {
  it('emits both idle and active text classes for the default mount-tier paint', () => {
    render(
      <TabButton isActive={false} onClick={() => {}}>
        Label
      </TabButton>,
    );
    const button = screen.getByRole('tab', { name: 'Label' });
    expect(button.className).toContain('text-[var(--mount-alt-text)]');
    expect(button.className).toContain('aria-selected:text-[var(--mount-bg)]');
  });

  it('emits the group-data-[surface=mount] overrides so orbit-tier paint kicks in inside a mount-host tablist', () => {
    render(
      <TabButton isActive={false} onClick={() => {}}>
        Label
      </TabButton>,
    );
    const button = screen.getByRole('tab', { name: 'Label' });
    expect(button.className).toContain(
      'group-data-[surface=mount]:text-[var(--orbit-alt-text)]',
    );
    expect(button.className).toContain(
      'group-data-[surface=mount]:aria-selected:text-[var(--orbit-bg)]',
    );
  });

  it('mirrors isActive on aria-selected', () => {
    const { rerender } = render(
      <TabButton isActive={false} onClick={() => {}}>
        Label
      </TabButton>,
    );
    expect(screen.getByRole('tab', { name: 'Label' })).toHaveAttribute(
      'aria-selected',
      'false',
    );

    rerender(
      <TabButton isActive={true} onClick={() => {}}>
        Label
      </TabButton>,
    );
    expect(screen.getByRole('tab', { name: 'Label' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('sets tabIndex to 0 when active and -1 when inactive (roving tabindex)', () => {
    const { rerender } = render(
      <TabButton isActive={true} onClick={() => {}}>
        Label
      </TabButton>,
    );
    expect(screen.getByRole('tab', { name: 'Label' }).tabIndex).toBe(0);

    rerender(
      <TabButton isActive={false} onClick={() => {}}>
        Label
      </TabButton>,
    );
    expect(screen.getByRole('tab', { name: 'Label' }).tabIndex).toBe(-1);
  });

  it('renders the fa-circle-dot active indicator only when isActive', () => {
    const { container, rerender } = render(
      <TabButton isActive={false} onClick={() => {}}>
        Label
      </TabButton>,
    );
    // visible span omits the dot when inactive; the sizing twin carries it
    const visibleSpan = container.querySelector(
      'span.col-start-1.row-start-1:not(.invisible)',
    );
    expect(visibleSpan).toBeTruthy();
    expect(visibleSpan!.querySelector('i.fa-circle-dot')).toBeFalsy();

    rerender(
      <TabButton isActive={true} onClick={() => {}}>
        Label
      </TabButton>,
    );
    const visibleSpanActive = container.querySelector(
      'span.col-start-1.row-start-1:not(.invisible)',
    );
    expect(visibleSpanActive!.querySelector('i.fa-circle-dot')).toBeTruthy();
  });

  it('always renders the off-screen extrabold sizing twin so the label does not jump width', () => {
    const { container, rerender } = render(
      <TabButton isActive={false} onClick={() => {}}>
        Label
      </TabButton>,
    );
    let twin = container.querySelector('span.invisible.font-extrabold');
    expect(twin).toBeTruthy();
    // twin carries the dot AND label so it reserves max width in any state
    expect(twin!.querySelector('i.fa-circle-dot')).toBeTruthy();
    expect(twin!.textContent).toContain('Label');

    rerender(
      <TabButton isActive={true} onClick={() => {}}>
        Label
      </TabButton>,
    );
    twin = container.querySelector('span.invisible.font-extrabold');
    expect(twin).toBeTruthy();
    expect(twin!.querySelector('i.fa-circle-dot')).toBeTruthy();
  });

  it('uses font-extrabold on active via aria-selected variant, font-semibold idle', () => {
    render(
      <TabButton isActive={false} onClick={() => {}}>
        Label
      </TabButton>,
    );
    const button = screen.getByRole('tab', { name: 'Label' });
    expect(button.className).toContain('font-semibold');
    expect(button.className).toContain('aria-selected:font-extrabold');
  });

  it('fires onClick when clicked', () => {
    const handleClick = vi.fn();
    render(
      <TabButton isActive={false} onClick={handleClick}>
        Label
      </TabButton>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Label' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('forwards extra props (id, aria-controls) to the underlying button', () => {
    render(
      <TabButton
        isActive={false}
        onClick={() => {}}
        id="tab-x"
        aria-controls="panel-x"
      >
        Label
      </TabButton>,
    );
    const button = screen.getByRole('tab', { name: 'Label' });
    expect(button.id).toBe('tab-x');
    expect(button.getAttribute('aria-controls')).toBe('panel-x');
  });
});

describe('TabButton isDisabled', () => {
  it('emits no aria-disabled at all by default, so other tab bars are untouched', () => {
    render(
      <TabButton isActive={false} onClick={() => {}}>
        Label
      </TabButton>,
    );
    expect(screen.getByRole('tab', { name: 'Label' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });

  it('marks itself aria-disabled without taking the native attribute', () => {
    render(
      <TabButton isActive={false} isDisabled onClick={() => {}}>
        Label
      </TabButton>,
    );
    const button = screen.getByRole('tab', { name: 'Label' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toBeDisabled();
  });

  // useTabNavigation clicks unconditionally; the guard is what stops it
  it('swallows the activation while isDisabled', () => {
    const handleClick = vi.fn();
    render(
      <TabButton isActive={false} isDisabled onClick={handleClick}>
        Label
      </TabButton>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Label' }));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('stays focusable while isDisabled so arrow keys can still reach it', () => {
    render(
      <TabButton isActive isDisabled onClick={() => {}}>
        Label
      </TabButton>,
    );
    const button = screen.getByRole('tab', { name: 'Label' });
    button.focus();
    expect(document.activeElement).toBe(button);
  });
});
