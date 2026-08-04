/**
 * Proves the row-header styling actually keys off the `scope` attribute.
 *
 * A substring check on the class string would pass even if the arbitrary
 * variant compiled to nothing, so this runs the real Tailwind pipeline and
 * then asks the DOM whether the emitted selector matches a row header and
 * misses a column header. That coupling is the whole point of driving the
 * visual off `scope` rather than a JS ternary: the styling cannot drift away
 * from the semantics, because it is the same attribute.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { compile } from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import { makePolicyMarkdownComponents } from './policyMarkdownComponents';

const requireFromHere = createRequire(import.meta.url);

/**
 * Resolves `@import "tailwindcss";` (and its relative sub-imports) off disk so
 * the compiler can register core variants + utilities.
 */
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

/** Pulls the class string the `th` mapping renders with. */
function thClassName(): string {
  const components = makePolicyMarkdownComponents({
    tableLabel: 'label',
    tableCaption: 'caption',
  });
  const rendered = (
    components.th as (properties: Record<string, unknown>) => {
      props: { className: string };
    }
  )({});
  return rendered.props.className;
}

/** Every selector in the compiled CSS whose body declares `property`. */
function selectorsDeclaring(css: string, property: string): string[] {
  const selectors: string[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[2].includes(property)) {
      selectors.push(match[1].trim());
    }
  }
  return selectors;
}

function makeHeaderCell(scope: string, className: string): HTMLElement {
  const cell = document.createElement('th');
  cell.setAttribute('scope', scope);
  cell.className = className;
  return cell;
}

describe('policy table header styling', () => {
  it.each([
    // Tailwind v4 emits the token reference, not the literal weight
    ['font-weight: var(--font-weight-normal)', 'undoes the UA bold'],
    ['vertical-align: top', 'matches the td mapping rather than centering'],
  ])('applies %s to row headers only', async (declaration) => {
    const className = thClassName();
    const css = await compileClasses(className.split(' '));
    const selectors = selectorsDeclaring(css, declaration);
    expect(selectors.length).toBeGreaterThan(0);

    const rowHeader = makeHeaderCell('row', className);
    const columnHeader = makeHeaderCell('col', className);

    expect(selectors.some((selector) => rowHeader.matches(selector))).toBe(
      true,
    );
    expect(selectors.some((selector) => columnHeader.matches(selector))).toBe(
      false,
    );
  });

  it('leaves text-align left on both, so a row header is never centered', async () => {
    const className = thClassName();
    const css = await compileClasses(className.split(' '));
    const selectors = selectorsDeclaring(css, 'text-align: left');

    const rowHeader = makeHeaderCell('row', className);
    const columnHeader = makeHeaderCell('col', className);

    expect(selectors.some((selector) => rowHeader.matches(selector))).toBe(
      true,
    );
    expect(selectors.some((selector) => columnHeader.matches(selector))).toBe(
      true,
    );
  });

  it('defaults scope to col when the tree does not set one', () => {
    const components = makePolicyMarkdownComponents({
      tableLabel: 'label',
      tableCaption: 'caption',
    });
    const rendered = (
      components.th as (properties: Record<string, unknown>) => {
        props: { scope: string };
      }
    )({});

    expect(rendered.props.scope).toBe('col');
  });

  it('lets the tree override scope, whatever the prop order', () => {
    const components = makePolicyMarkdownComponents({
      tableLabel: 'label',
      tableCaption: 'caption',
    });
    const rendered = (
      components.th as (properties: Record<string, unknown>) => {
        props: { scope: string };
      }
    )({ scope: 'row' });

    expect(rendered.props.scope).toBe('row');
  });
});
