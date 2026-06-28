/*
 * Tests for the ColorEditor orchestrator: the Light/Dark tabs, the pre-custom
 * seed disclosure, and the "show all colors" drawer that holds the token tree.
 *
 * The knobs themselves are exercised in KnobPanel.test.tsx and the drawer's
 * internals in TokenTree.test.tsx; here we cover the orchestration — drawer
 * toggle (mount + hidden), tab order, and that the token-tree search/rows are
 * reachable once the drawer is open.
 */

import ColorEditor from './ColorEditor';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TokenContrastFailure } from './contrastResults';
import {
  EDITABLE_VARS,
  VAR_GROUPS,
  type ThemeVariable,
} from './useThemeOverrides';

const PLACEHOLDER_VALUE = '#abcdef';

function buildColorValues(): Record<ThemeVariable, string> {
  return Object.fromEntries(
    EDITABLE_VARS.map((variable) => [variable, PLACEHOLDER_VALUE]),
  ) as Record<ThemeVariable, string>;
}

function renderEditor(
  contrastFailures: Map<string, TokenContrastFailure> = new Map(),
  customActive = true,
  { autoOpen = true }: { autoOpen?: boolean } = {},
) {
  const utils = render(
    <ColorEditor
      colorValues={buildColorValues()}
      contrastFailures={contrastFailures}
      knobFailures={new Map()}
      baseThemeLabel="Boyhood"
      customActive={customActive}
      onOverride={vi.fn()}
      onKnobOverride={vi.fn()}
      editorMode="dark"
      onEditorModeChange={vi.fn()}
    />,
  );
  if (autoOpen) openDrawer();
  return utils;
}

function openDrawer() {
  fireEvent.click(screen.getByRole('button', { name: /show all colors/i }));
}

function getSearchbox() {
  return screen.getByRole('searchbox', { name: /search tokens/i });
}

describe('ColorEditor – "show all colors" drawer (mount + hidden)', () => {
  it('mounts the token tree always; the toggle aria-controls resolves while collapsed', () => {
    renderEditor(new Map(), true, { autoOpen: false });
    const toggle = screen.getByRole('button', { name: /show all colors/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const controlledId = toggle.getAttribute('aria-controls');
    expect(controlledId).toBe('theme-editor-token-tree');
    // The controlled element is present (mounted) even while collapsed…
    const tree = document.getElementById(controlledId as string);
    expect(tree).not.toBeNull();
    // …but hidden, so its searchbox/rows are out of the a11y tree.
    expect(tree).toHaveAttribute('hidden');
    expect(screen.queryByRole('searchbox')).toBeNull();
  });

  it('reveals the tree on expand without unmounting it', () => {
    renderEditor(new Map(), true, { autoOpen: false });
    const toggle = screen.getByRole('button', { name: /show all colors/i });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      document.getElementById('theme-editor-token-tree'),
    ).not.toHaveAttribute('hidden');
    expect(getSearchbox()).toBeInTheDocument();
  });
});

describe('ColorEditor – token search (inside the drawer)', () => {
  it('shows every bundle section when no query is entered', () => {
    renderEditor();
    for (const group of VAR_GROUPS) {
      expect(
        screen.getByRole('button', { name: new RegExp(`^${group.label}`) }),
      ).toBeInTheDocument();
    }
  });

  it('filters bundle labels case-insensitively', () => {
    renderEditor();
    fireEvent.change(getSearchbox(), { target: { value: 'MOUNT' } });
    expect(screen.getByRole('button', { name: /^Mount/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Alert/ })).toBeNull();
  });

  it('filters variable names with or without leading dashes', () => {
    renderEditor();
    fireEvent.change(getSearchbox(), { target: { value: '--alert-bg' } });
    expect(screen.getByRole('button', { name: /^Alert/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Mount/ })).toBeNull();
  });

  it('auto-expands matching bundles while a query is active', () => {
    renderEditor();
    fireEvent.change(getSearchbox(), { target: { value: 'warn' } });
    const warnButton = screen.getByRole('button', { name: /^Warn/ });
    expect(warnButton).toHaveAttribute('aria-expanded', 'true');
  });

  it('announces match count via the live region', () => {
    renderEditor();
    const status = document.getElementById('theme-editor-token-search-status');
    expect(status).not.toBeNull();
    expect(status?.textContent ?? '').toBe('');

    fireEvent.change(getSearchbox(), { target: { value: 'qqqqzz' } });
    expect(status?.textContent).toMatch(/No tokens match/);

    fireEvent.change(getSearchbox(), { target: { value: 'subtle' } });
    expect(status?.textContent).toMatch(/^1 token matches$/);
  });

  it('clears the query when Escape is pressed', () => {
    renderEditor();
    const searchbox = getSearchbox();
    fireEvent.change(searchbox, { target: { value: 'mount' } });
    expect((searchbox as HTMLInputElement).value).toBe('mount');
    fireEvent.keyDown(searchbox, { key: 'Escape' });
    expect((searchbox as HTMLInputElement).value).toBe('');
  });

  it('wraps the search input in a role="search" landmark labelled "Search theme tokens"', () => {
    renderEditor();
    const landmark = screen.getByRole('search', {
      name: /search theme tokens/i,
    });
    expect(
      within(landmark).getByLabelText(/search tokens/i),
    ).toBeInTheDocument();
  });
});

describe('ColorEditor – Light/Dark palette tabs', () => {
  it('renders the mode selector as the card lead control and commits a change', () => {
    const onEditorModeChange = vi.fn();
    render(
      <ColorEditor
        colorValues={buildColorValues()}
        contrastFailures={new Map()}
        knobFailures={new Map()}
        baseThemeLabel="Boyhood"
        customActive={true}
        onOverride={vi.fn()}
        onKnobOverride={vi.fn()}
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
    renderEditor(new Map(), false, { autoOpen: false });
    const note = screen.getByRole('note');
    expect(note.textContent).toBe(
      'These start from Boyhood. Editing any color saves it as your own theme.',
    );
  });

  it('drops the seed note once the custom theme is active', () => {
    renderEditor(new Map(), true, { autoOpen: false });
    expect(screen.queryByText(/these start from boyhood/i)).toBeNull();
  });
});

describe('ColorEditor – tab order', () => {
  function precedes(first: Element, second: Element): boolean {
    return Boolean(
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  }

  it('orders mode toggle → knobs (picker→hex) → show all colors → search → bundles', () => {
    renderEditor();
    const modeGroup = screen.getByRole('group', { name: /palette to edit/i });
    const darkTab = within(modeGroup).getByRole('button', {
      name: /dark colors/i,
    });
    const accentPicker = screen.getByLabelText('Accent color');
    const accentHex = screen.getByLabelText('Accent color hex value');
    const alertsHex = screen.getByLabelText('Alerts color hex value');
    // The drawer is open (auto-opened), so the toggle reads "Hide all colors".
    const showAll = screen.getByRole('button', { name: /all colors/i });
    const searchbox = getSearchbox();
    const baseBundle = screen.getByRole('button', { name: /^Base/ });

    expect(precedes(darkTab, accentPicker)).toBe(true);
    expect(precedes(accentPicker, accentHex)).toBe(true);
    expect(precedes(alertsHex, showAll)).toBe(true);
    expect(precedes(showAll, searchbox)).toBe(true);
    expect(precedes(searchbox, baseBundle)).toBe(true);
  });

  it('uses no positive tabindex anywhere', () => {
    const { container } = renderEditor();
    const positive = Array.from(
      container.querySelectorAll('[tabindex]'),
    ).filter((element) => Number(element.getAttribute('tabindex')) > 0);
    expect(positive).toEqual([]);
  });
});

describe('ColorEditor – drawer rows still editable (BL1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  const failure: TokenContrastFailure = {
    ratio: 2.9,
    threshold: 4.5,
    pairLabel: 'text / bg',
  };

  it('keeps the hex input editable and marks a failing token after the debounce', () => {
    renderEditor(new Map([['--base-text', failure]]));
    const input = screen.getByRole('textbox', { name: /Base text/i });
    expect(input).not.toHaveAttribute('readonly');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    act(() => {
      vi.advanceTimersByTime(400);
    });

    const describedById = input.getAttribute('aria-describedby');
    const note = document.getElementById(describedById as string);
    expect(note?.textContent).toContain('Fails contrast with text / bg');
    expect(note?.textContent).toContain('2.9:1, needs 4.5:1');
  });
});
