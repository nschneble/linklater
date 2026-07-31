/*
 * Tests for SlidingTabBar, the shared animated-pill tablist.
 *
 * Two contracts pinned here:
 * 1. The `surface` prop drives container bg + pill bg via the
 *    `data-surface` attribute on the tablist. `surface="base"` (default)
 *    paints from the mount bundle one lift up; `surface="mount"` paints
 *    from the orbit bundle. Forwarded to child `TabButton`s via DOM
 *    ancestry (group-data-* variants), no prop passing needed.
 * 2. Pill geometry (translateX = activeIndex * 100%, width =
 *    calc(100/N% - 4px)) drives the sliding-pill animation. A regression
 *    here would silently break the active-tab indicator.
 *
 * ARIA wiring (role="tablist", aria-label, aria-selected via TabButton)
 * also gets a smoke check so screen reader exposure does not drift.
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import SlidingTabBar from './SlidingTabBar';
import type { SlidingTab } from './SlidingTabBar';

function makeTabs(overrides: Partial<SlidingTab>[] = []): SlidingTab[] {
  const defaults: SlidingTab[] = [
    { id: 'one', label: 'One', onClick: () => {} },
    { id: 'two', label: 'Two', onClick: () => {} },
  ];
  return defaults.map((tab, index) => ({
    ...tab,
    ...(overrides[index] ?? {}),
  }));
}

describe('SlidingTabBar', () => {
  it('defaults to base surface – container paints mount-bg, pill paints mount-text', () => {
    render(
      <SlidingTabBar ariaLabel="example" activeIndex={0} tabs={makeTabs()} />,
    );
    const tablist = screen.getByRole('tablist');
    expect(tablist.getAttribute('data-surface')).toBe('base');
    expect(tablist.className).toContain('bg-[var(--mount-bg)]');
    expect(tablist.className).toContain(
      'data-[surface=mount]:bg-[var(--orbit-bg)]',
    );

    // pill is the aria-hidden div inside the tablist
    const pill = tablist.querySelector('[aria-hidden="true"]');
    expect(pill).toBeTruthy();
    expect(pill!.className).toContain('bg-[var(--mount-text)]');
    expect(pill!.className).toContain(
      'group-data-[surface=mount]:bg-[var(--orbit-text)]',
    );
  });

  it('surface="mount" lifts the chip – data-surface attribute carries the host bundle', () => {
    render(
      <SlidingTabBar
        ariaLabel="example"
        activeIndex={0}
        surface="mount"
        tabs={makeTabs()}
      />,
    );
    const tablist = screen.getByRole('tablist');
    expect(tablist.getAttribute('data-surface')).toBe('mount');
  });

  it('exposes role="tablist" and the supplied ariaLabel', () => {
    render(
      <SlidingTabBar
        ariaLabel="filter mode"
        activeIndex={0}
        tabs={makeTabs()}
      />,
    );
    expect(screen.getByRole('tablist')).toHaveAttribute(
      'aria-label',
      'filter mode',
    );
  });

  it('positions the pill via translateX = activeIndex * 100%', () => {
    const { rerender } = render(
      <SlidingTabBar ariaLabel="example" activeIndex={0} tabs={makeTabs()} />,
    );
    const pillAt0 = screen
      .getByRole('tablist')
      .querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(pillAt0.style.transform).toBe('translateX(0%)');

    rerender(
      <SlidingTabBar ariaLabel="example" activeIndex={1} tabs={makeTabs()} />,
    );
    const pillAt1 = screen
      .getByRole('tablist')
      .querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(pillAt1.style.transform).toBe('translateX(100%)');
  });

  it('sizes the pill to calc(<100/N>% - 4px) for N tabs', () => {
    render(
      <SlidingTabBar
        ariaLabel="example"
        activeIndex={0}
        tabs={makeTabs([{}, {}])}
      />,
    );
    const pill = screen
      .getByRole('tablist')
      .querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(pill.style.width).toBe('calc(50% - 4px)');
  });

  it("clicking an inactive tab fires that tab's onClick", () => {
    const handleOne = vi.fn();
    const handleTwo = vi.fn();
    render(
      <SlidingTabBar
        ariaLabel="example"
        activeIndex={0}
        tabs={[
          { id: 'one', label: 'One', onClick: handleOne },
          { id: 'two', label: 'Two', onClick: handleTwo },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }));
    expect(handleTwo).toHaveBeenCalledTimes(1);
    expect(handleOne).not.toHaveBeenCalled();
  });

  it('marks the active tab via aria-selected', () => {
    render(
      <SlidingTabBar ariaLabel="example" activeIndex={1} tabs={makeTabs()} />,
    );
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('forwards aria-controls from each tab descriptor to its button', () => {
    render(
      <SlidingTabBar
        ariaLabel="example"
        activeIndex={0}
        tabs={[
          {
            id: 'one',
            ariaControls: 'panel-one',
            label: 'One',
            onClick: () => {},
          },
          {
            id: 'two',
            ariaControls: 'panel-two',
            label: 'Two',
            onClick: () => {},
          },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'One' })).toHaveAttribute(
      'aria-controls',
      'panel-one',
    );
    expect(screen.getByRole('tab', { name: 'Two' })).toHaveAttribute(
      'aria-controls',
      'panel-two',
    );
  });

  it('uses `group` on the tablist so descendant TabButtons can read data-surface', () => {
    render(
      <SlidingTabBar ariaLabel="example" activeIndex={0} tabs={makeTabs()} />,
    );
    // strip `group` and the TabButton fg group-data-* classes go dead
    expect(screen.getByRole('tablist').className).toContain('group');
  });
});
