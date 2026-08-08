/*
 * Tests for the bundle tablist (a11y brief §1/§2): a WAI-ARIA tabs widget with
 * automatic activation + roving tabindex. Choosing a bundle (click or arrow)
 * immediately shows only that bundle's raw slots, sourced from VAR_GROUPS.
 *
 * BundleTabs is controlled (active bundle is a prop), so a small stateful
 * harness mirrors the real parent: it re-renders with the chosen bundle so the
 * panel + roving tabindex track the selection.
 */

import {
  BUNDLES,
  EDITABLE_VARS,
  VAR_GROUPS,
  type Bundle,
  type ThemeVariable,
} from './useThemeOverrides';
import BundleTabs from './BundleTabs';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { TokenContrastFailure } from './contrastResults.notes';

const A_FAILURE: TokenContrastFailure = {
  ratio: 2,
  threshold: 4.5,
  noteSubject: 'Text',
};

const PLACEHOLDER_VALUE = '#abcdef';

function buildColorValues(): Record<ThemeVariable, string> {
  return Object.fromEntries(
    EDITABLE_VARS.map((variable) => [variable, PLACEHOLDER_VALUE]),
  ) as Record<ThemeVariable, string>;
}

function Harness({
  initial = 'base' as Bundle,
  failures = new Map<string, TokenContrastFailure>(),
} = {}) {
  const [activeBundle, setActiveBundle] = useState<Bundle>(initial);
  // mirror ColorEditor: the tablist is named by the "Color Bundles" h2
  return (
    <>
      <h2 id="color-bundles-heading">Color Bundles</h2>
      <BundleTabs
        colorValues={buildColorValues()}
        contrastFailures={failures}
        activeBundle={activeBundle}
        onBundleChange={setActiveBundle}
        onOverride={vi.fn()}
        tablistLabelledBy="color-bundles-heading"
      />
    </>
  );
}

function bundleLabel(bundle: Bundle): string {
  return VAR_GROUPS.find((group) => group.bundle === bundle)!.label;
}

function tab(bundle: Bundle) {
  return screen.getByRole('tab', { name: bundleLabel(bundle) });
}

describe('BundleTabs – per-bundle contrast-error indicator', () => {
  it('flags the tab whose bundle owns a failing token, and no others', () => {
    render(<Harness failures={new Map([['--mount-bg', A_FAILURE]])} />);

    // sr-only suffix reaches AT; visible "Mount" stays the name base (2.5.3)
    const mountTab = screen.getByRole('tab', {
      name: 'Mount, has contrast errors',
    });
    expect(mountTab.querySelector('.fa-triangle-exclamation')).not.toBeNull();

    // a bundle with no failing token has neither the glyph nor the note
    const baseTab = screen.getByRole('tab', { name: 'Base' });
    expect(baseTab.querySelector('.fa-triangle-exclamation')).toBeNull();
  });

  it('routes a focus-ring failure to the Base tab (it rides the base group)', () => {
    render(<Harness failures={new Map([['--focus-ring', A_FAILURE]])} />);
    const baseTab = screen.getByRole('tab', {
      name: 'Base, has contrast errors',
    });
    expect(baseTab.querySelector('.fa-circle-dot')).not.toBeNull();
    expect(baseTab.querySelector('.fa-triangle-exclamation')).toBeNull();
  });

  it('shows only the selection dot on an active failing tab', () => {
    render(
      <Harness
        initial="mount"
        failures={new Map([['--mount-bg', A_FAILURE]])}
      />,
    );
    const mountTab = screen.getByRole('tab', {
      name: 'Mount, has contrast errors',
    });
    expect(mountTab.querySelector('.fa-circle-dot')).not.toBeNull();
    expect(mountTab.querySelector('.fa-triangle-exclamation')).toBeNull();
  });
});

describe('BundleTabs – hover affordance (parity with the page tab pills)', () => {
  it('brightens the border and adds a shadow on hover', () => {
    render(<Harness />);
    // hover only strengthens the border, never weakens the 1.4.11 boundary
    const pill = tab('mount');
    expect(pill).toHaveClass('hover:border-[var(--mount-text)]');
    expect(pill).toHaveClass('hover:border-shadow');
  });
});

describe('BundleTabs – tablist structure', () => {
  it('exposes a horizontal tablist with one tab per bundle', () => {
    render(<Harness />);
    const tablist = screen.getByRole('tablist', { name: /color bundles/i });
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
    // every non-active tab is removed from the Tab order (roving)
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
    // one fixed panel; every tab's aria-controls resolves to it, not a dead id
    const panel = screen.getByRole('tabpanel');
    for (const bundle of BUNDLES) {
      expect(tab(bundle)).toHaveAttribute('aria-controls', panel.id);
    }
  });

  it('does not make the panel a focusable tab stop (AUD-W1)', () => {
    render(<Harness />);
    // panel holds focusable rows, so no tabIndex (a stop would violate APG)
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
    // still on the first bundle, no wrap to the last
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

/*
 * The selected tab reads as a FILLED pill: the inverse of the unselected pair
 * (--mount-text bg / --mount-bg label), so it inherits the enforced
 * fg/bg contrast for free, plus a non-color 2nd channel (the fa-circle-dot
 * glyph) so selection survives CVD (SC 1.4.1). These are static aria-variant
 * classes, so class-string + glyph-presence are the right guard.
 */
describe('BundleTabs – filled-pill selected-state contract (SC 1.4.1)', () => {
  it('emits the inverse fill/label tokens + the fa-circle-dot 2nd channel on the selected tab', () => {
    render(<Harness />);
    const selected = tab('base');
    expect(selected).toHaveAttribute('aria-selected', 'true');
    expect(selected.className).toContain(
      'aria-selected:bg-[var(--mount-text)]',
    );
    expect(selected.className).toContain(
      'aria-selected:text-[var(--mount-bg)]',
    );
    // the non-color second channel lives inside the selected tab
    expect(selected.querySelector('.fa-circle-dot')).not.toBeNull();
  });
});
