/*
 * Tests for the ColorEditor orchestrator: the Light/Dark mode toggle, the named
 * "Colors" region, the pre-custom seed disclosure, and that the bundle tablist
 * is wired in. The tablist's own keyboard/roving behavior lives in
 * BundleTabs.test.tsx.
 */

import ColorEditor from './ColorEditor';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { TokenContrastFailure } from './contrastResults';
import { EDITABLE_VARS, type ThemeVariable } from './useThemeOverrides';

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
      editorMode="dark"
      onEditorModeChange={vi.fn()}
    />,
  );
}

describe('ColorEditor – named Colors region (a11y brief §3)', () => {
  it('wraps the editing surface in a region named by the "Colors" h2', () => {
    renderEditor();
    const heading = screen.getByRole('heading', { level: 2, name: 'Colors' });
    const region = screen.getByRole('region', { name: 'Colors' });
    expect(region).toContainElement(heading);
    // The bundle tablist lives inside the named region.
    expect(
      within(region).getByRole('tablist', { name: /bundle to edit/i }),
    ).toBeInTheDocument();
  });
});

describe('ColorEditor – Light/Dark palette toggle', () => {
  it('renders the mode toggle as the lead control and commits a change', () => {
    const onEditorModeChange = vi.fn();
    render(
      <ColorEditor
        colorValues={buildColorValues()}
        failures={new Map()}
        baseThemeLabel="Boyhood"
        customActive={true}
        onOverride={vi.fn()}
        editorMode="dark"
        onEditorModeChange={onEditorModeChange}
      />,
    );
    const group = screen.getByRole('group', { name: /palette to edit/i });
    expect(
      within(group).getByRole('button', { name: /dark colors/i }),
    ).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(
      within(group).getByRole('button', { name: /light colors/i }),
    );
    expect(onEditorModeChange).toHaveBeenCalledWith('light');
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

  it('orders mode toggle → bundle tablist → slot rows', () => {
    renderEditor();
    const modeGroup = screen.getByRole('group', { name: /palette to edit/i });
    const darkButton = within(modeGroup).getByRole('button', {
      name: /dark colors/i,
    });
    const baseTab = screen.getByRole('tab', { name: 'Base' });
    // The default active bundle (base) shows its Background slot row first.
    const firstSlot = screen.getByLabelText('Color picker for Background');

    expect(precedes(darkButton, baseTab)).toBe(true);
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
