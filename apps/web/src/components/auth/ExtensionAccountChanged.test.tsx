/*
 * The region shape itself, apart from the page that hosts it.
 *
 * What the page suite can ask is whether the right words arrive. What it
 * cannot ask is whether they arrive as one announcement, because the
 * rendered text is identical either way: two live roots and one live root
 * hold the same strings, and only the number of utterances differs. The
 * assertions below are about that number.
 *
 * The collapse is asked of the compiled CSS rather than of the DOM. jsdom
 * computes no layout and this suite loads no stylesheet, so a
 * `getComputedStyle` reading here would report the initial value whatever
 * the class said, and a substring check on `className` would only prove
 * the string is present. Compiling the classes proves the rule exists and
 * proves the variant is real, since a variant Tailwind does not know
 * emits nothing at all. It does not prove the rule wins the cascade in a
 * browser; that half is Tuffgal's.
 */

import { compile } from 'tailwindcss';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import ExtensionAccountChanged from './ExtensionAccountChanged';
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';

const requireFromHere = createRequire(import.meta.url);

const STATEMENT_ID = 'extension-account-changed';
const NEXT_STEP_ID = 'extension-account-changed-next';

function loadStylesheet(id: string, base: string) {
  const path =
    id === 'tailwindcss'
      ? resolve(
          dirname(requireFromHere.resolve('tailwindcss/package.json')),
          'index.css',
        )
      : resolve(base, id);
  return { base: dirname(path), content: readFileSync(path, 'utf8'), path };
}

async function compileClasses(classes: string[]): Promise<string> {
  const compiler = await compile('@import "tailwindcss";', {
    base: process.cwd(),
    loadStylesheet,
  });
  return compiler.build(classes);
}

/**
 * The declarations Tailwind emitted for one selector, whitespace
 * collapsed. A rule that was never emitted answers `null`, which is how a
 * variant the compiler does not recognise fails rather than passes: it
 * produces no output at all, and a substring search over the whole sheet
 * would find the property in somebody else's rule.
 */
function ruleFor(css: string, selector: string): string | null {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (match === null) return null;
  return match[1].replace(/\s+/g, ' ').trim();
}

function regionNode(): HTMLElement {
  return screen.getByTestId('extension-account-changed-region');
}

describe('ExtensionAccountChanged', () => {
  it('carries the live-region contract on one root', () => {
    render(<ExtensionAccountChanged mismatched={false} />);

    expect(regionNode()).toHaveAttribute('role', 'status');
    expect(regionNode()).toHaveAttribute('aria-live', 'polite');
    expect(regionNode()).toHaveAttribute('aria-atomic', 'true');
  });

  it('holds no second live root inside it', () => {
    render(<ExtensionAccountChanged mismatched />);

    // a nested root splits one utterance in two, and the split is silent
    expect(
      regionNode().querySelectorAll('[aria-live], [role="status"]'),
    ).toHaveLength(0);
  });

  it('keeps both described nodes mounted while it is empty', () => {
    const { container } = render(
      <ExtensionAccountChanged mismatched={false} />,
    );

    expect(container.querySelector(`#${STATEMENT_ID}`)).not.toBeNull();
    expect(container.querySelector(`#${NEXT_STEP_ID}`)).not.toBeNull();
    expect(regionNode()).toHaveTextContent('');
  });

  it('fills the same node it mounted rather than a new one', () => {
    const { rerender } = render(<ExtensionAccountChanged mismatched={false} />);
    const before = regionNode();

    rerender(<ExtensionAccountChanged mismatched />);

    // a remount re-registers the region, and re-registration is not a change
    expect(regionNode()).toBe(before);
    expect(regionNode()).toHaveTextContent(
      'This tab is now signed in to a different account.',
    );
    expect(regionNode()).toHaveTextContent(
      'Close this tab and start again from the extension.',
    );
  });

  it('marks the populated state on the region itself', () => {
    const { rerender } = render(<ExtensionAccountChanged mismatched={false} />);

    expect(regionNode()).not.toHaveAttribute('data-mismatched');

    rerender(<ExtensionAccountChanged mismatched />);
    expect(regionNode()).toHaveAttribute('data-mismatched');
  });

  it('compiles a collapse that takes the empty region out of flow and puts it back', async () => {
    const css = await compileClasses([
      'absolute',
      'data-mismatched:static',
      'space-y-4',
    ]);

    // preflight declares display of its own, so read only the two rules
    expect(ruleFor(css, '.absolute')).toBe('position: absolute;');
    expect(ruleFor(css, '.data-mismatched\\:static[data-mismatched]')).toBe(
      'position: static;',
    );
  });
});
