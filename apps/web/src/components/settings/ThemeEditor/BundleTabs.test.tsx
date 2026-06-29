/*
 * Tests for the bundle tablist (a11y brief §1/§2): a WAI-ARIA tabs widget with
 * automatic activation + roving tabindex. Choosing a bundle (click or arrow)
 * immediately shows only that bundle's raw slots, sourced from VAR_GROUPS.
 *
 * BundleTabs is controlled (active bundle is a prop), so a small stateful
 * harness mirrors the real parent: it re-renders with the chosen bundle so the
 * panel + roving tabindex track the selection.
 */

import BundleTabs from './BundleTabs';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  BUNDLES,
  EDITABLE_VARS,
  VAR_GROUPS,
  type Bundle,
  type ThemeVariable,
} from './useThemeOverrides';

const PLACEHOLDER_VALUE = '#abcdef';

function buildColorValues(): Record<ThemeVariable, string> {
  return Object.fromEntries(
    EDITABLE_VARS.map((variable) => [variable, PLACEHOLDER_VALUE]),
  ) as Record<ThemeVariable, string>;
}

function Harness({ initial = 'base' as Bundle } = {}) {
  const [activeBundle, setActiveBundle] = useState<Bundle>(initial);
  return (
    <BundleTabs
      colorValues={buildColorValues()}
      contrastFailures={new Map()}
      activeBundle={activeBundle}
      onBundleChange={setActiveBundle}
      onOverride={vi.fn()}
    />
  );
}

function bundleLabel(bundle: Bundle): string {
  return VAR_GROUPS.find((group) => group.bundle === bundle)!.label;
}

function tab(bundle: Bundle) {
  return screen.getByRole('tab', { name: bundleLabel(bundle) });
}

describe('BundleTabs – tablist structure', () => {
  it('exposes a horizontal tablist with one tab per bundle', () => {
    render(<Harness />);
    const tablist = screen.getByRole('tablist', { name: /bundle to edit/i });
    expect(tablist).toHaveAttribute('aria-orientation', 'horizontal');
    const tabs = within(tablist).getAllByRole('tab');
    expect(tabs).toHaveLength(BUNDLES.length);
  });

  it('marks exactly one tab selected and gives it the only tabIndex 0', () => {
    render(<Harness />);
    const selected = screen
      .getAllByRole('tab')
      .filter((element) => element.getAttribute('aria-selected') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent('Base');

    const tabbable = screen
      .getAllByRole('tab')
      .filter((element) => element.getAttribute('tabindex') === '0');
    expect(tabbable).toEqual(selected);
    // Every non-active tab is removed from the Tab order (roving).
    const roved = screen
      .getAllByRole('tab')
      .filter((element) => element.getAttribute('tabindex') === '-1');
    expect(roved).toHaveLength(BUNDLES.length - 1);
  });

  it('resolves the active tab aria-controls to the live panel', () => {
    render(<Harness />);
    const panelId = tab('base').getAttribute('aria-controls');
    const panel = document.getElementById(panelId as string);
    expect(panel).not.toBeNull();
    expect(panel).toHaveAttribute('role', 'tabpanel');
    expect(panel).toHaveAttribute('aria-labelledby', tab('base').id);
  });

  it('points EVERY tab aria-controls at the one fixed panel (AUD-W2)', () => {
    render(<Harness />);
    // The single physical panel never changes identity, so a non-active tab's
    // aria-controls must resolve to that same live panel — not a per-bundle id
    // that points at nothing while another bundle is shown.
    const panel = screen.getByRole('tabpanel');
    for (const bundle of BUNDLES) {
      expect(tab(bundle)).toHaveAttribute('aria-controls', panel.id);
    }
  });

  it('does not make the panel a focusable tab stop (AUD-W1)', () => {
    render(<Harness />);
    // The panel always contains focusable slot rows, so it must NOT itself be a
    // tab stop (no tabIndex) — an inert stop would be a redundant APG violation.
    expect(screen.getByRole('tabpanel')).not.toHaveAttribute('tabindex');
  });
});

describe('BundleTabs – automatic activation + roving tabindex', () => {
  it('activates a clicked tab and swaps the panel to its slots', () => {
    render(<Harness />);
    fireEvent.click(tab('mount'));
    expect(tab('mount')).toHaveAttribute('aria-selected', 'true');
    expect(tab('base')).toHaveAttribute('aria-selected', 'false');
    expect(tab('mount')).toHaveAttribute('tabindex', '0');
    expect(tab('base')).toHaveAttribute('tabindex', '-1');
  });

  it('ArrowRight moves selection to the next bundle and keeps focus on it', () => {
    render(<Harness />);
    tab('base').focus();
    fireEvent.keyDown(tab('base'), { key: 'ArrowRight' });
    expect(tab('mount')).toHaveAttribute('aria-selected', 'true');
    expect(tab('mount')).toHaveFocus();
  });

  it('ArrowLeft moves selection to the previous bundle', () => {
    render(<Harness initial="orbit" />);
    fireEvent.keyDown(tab('orbit'), { key: 'ArrowLeft' });
    expect(tab('mount')).toHaveAttribute('aria-selected', 'true');
  });

  it('does NOT wrap past the first or last tab', () => {
    render(<Harness />);
    fireEvent.keyDown(tab('base'), { key: 'ArrowLeft' });
    // Still on the first bundle — no wrap to the last.
    expect(tab('base')).toHaveAttribute('aria-selected', 'true');

    const last = BUNDLES[BUNDLES.length - 1];
    fireEvent.click(tab(last));
    fireEvent.keyDown(tab(last), { key: 'ArrowRight' });
    expect(tab(last)).toHaveAttribute('aria-selected', 'true');
  });

  it('Home/End jump to the first/last bundle', () => {
    render(<Harness initial="info" />);
    fireEvent.keyDown(tab('info'), { key: 'End' });
    expect(tab(BUNDLES[BUNDLES.length - 1])).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.keyDown(tab(BUNDLES[BUNDLES.length - 1]), { key: 'Home' });
    expect(tab('base')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('BundleTabs – per-bundle slot list (sourced from VAR_GROUPS)', () => {
  function slotCount(bundle: Bundle): number {
    return VAR_GROUPS.find((group) => group.bundle === bundle)!.items.length;
  }

  it('shows base its full 10 slots (7 shared + subtle-text + input-bg + focus ring)', () => {
    render(<Harness />);
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getAllByRole('textbox')).toHaveLength(
      slotCount('base'),
    );
    expect(slotCount('base')).toBe(10);
  });

  it('shows mount its 8 slots (7 shared + input-bg)', () => {
    render(<Harness initial="mount" />);
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getAllByRole('textbox')).toHaveLength(
      slotCount('mount'),
    );
    expect(slotCount('mount')).toBe(8);
  });

  it('shows a state bundle its 7 shared slots', () => {
    render(<Harness initial="alert" />);
    const panel = screen.getByRole('tabpanel');
    expect(within(panel).getAllByRole('textbox')).toHaveLength(
      slotCount('alert'),
    );
    expect(slotCount('alert')).toBe(7);
  });

  it('renders only the active bundle panel, not seven mounted panels', () => {
    render(<Harness />);
    expect(screen.getAllByRole('tabpanel')).toHaveLength(1);
  });
});
