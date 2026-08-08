/*
 * Tests for the ColorEditor orchestrator: the named "Colors" region, the
 * pre-custom seed disclosure, and that the bundle tablist is wired in. The
 * tablist's own keyboard/roving behavior lives in BundleTabs.test.tsx; the
 * Light/Dark palette toggle moved to the header toolbar and is covered in
 * index.test.tsx.
 */

import ColorEditor from './ColorEditor';
import { describe, expect, it, vi } from 'vitest';
import { EDITABLE_VARS, type ThemeVariable } from './useThemeOverrides';
import { render, screen, within } from '@testing-library/react';
import type { TokenContrastFailure } from './contrastResults.notes';

const PLACEHOLDER_VALUE = '#abcdef';

function buildColorValues(): Record<ThemeVariable, string> {
  return Object.fromEntries(
    EDITABLE_VARS.map((variable) => [variable, PLACEHOLDER_VALUE]),
  ) as Record<ThemeVariable, string>;
}

function renderEditor(
  failures: Map<string, TokenContrastFailure> = new Map(),
  customActive = true,
) {
  return render(
    <ColorEditor
      colorValues={buildColorValues()}
      failures={failures}
      baseThemeLabel="Boyhood"
      customActive={customActive}
      onOverride={vi.fn()}
      activeBundle="base"
      onActiveBundleChange={vi.fn()}
    />,
  );
}

describe('ColorEditor – named Color Bundles region (a11y brief §3)', () => {
  it('wraps the editing surface in a region named by the "Color Bundles" h2', () => {
    renderEditor();
    const heading = screen.getByRole('heading', {
      level: 2,
      name: 'Color Bundles',
    });
    const region = screen.getByRole('region', { name: 'Color Bundles' });
    expect(region).toContainElement(heading);
    // tablist sits inside the region, labelled by the same "Color Bundles" h2
    expect(
      within(region).getByRole('tablist', { name: /color bundles/i }),
    ).toBeInTheDocument();
  });

  it('renders the "Colors" h3 between the tablist and the slot panel', () => {
    renderEditor();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Colors' }),
    ).toBeInTheDocument();
  });
});

describe('ColorEditor – mode toggle relocated to the toolbar', () => {
  it('no longer renders the Light/Dark palette toggle inside the region', () => {
    renderEditor();
    expect(
      screen.queryByRole('group', { name: /palette to edit/i }),
    ).toBeNull();
  });
});

describe('ColorEditor – pre-custom seed disclosure (SC 3.3.2)', () => {
  it('discloses that swatches start from the theme until custom is active', () => {
    renderEditor(new Map(), false);
    const note = screen.getByRole('note');
    expect(note.textContent).toBe(
      'These start from Boyhood. Editing any color saves it as your own theme.',
    );
  });

  it('drops the seed note once the custom theme is active', () => {
    renderEditor(new Map(), true);
    expect(screen.queryByText(/these start from boyhood/i)).toBeNull();
  });
});

describe('ColorEditor – tab order', () => {
  function precedes(first: Element, second: Element): boolean {
    return Boolean(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  }

  it('orders bundle tablist → slot rows', () => {
    renderEditor();
    const baseTab = screen.getByRole('tab', { name: 'Base' });
    // the default active bundle (base) shows its Background slot row first
    const firstSlot = screen.getByLabelText('Color picker for Background');

    expect(precedes(baseTab, firstSlot)).toBe(true);
  });

  it('uses no positive tabindex anywhere', () => {
    const { container } = renderEditor();
    const positive = Array.from(
      container.querySelectorAll('[tabindex]'),
    ).filter((element) => Number(element.getAttribute('tabindex')) > 0);
    expect(positive).toEqual([]);
  });
});
