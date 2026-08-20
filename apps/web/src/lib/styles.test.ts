import {
  ARIA_DISABLED,
  DISABLED,
  FOCUS_RING,
  FOCUS_RING_FLUSH,
  menuRevealStyle,
} from './styles';
import { compileClasses } from '../../test/tailwind';
import { describe, expect, it } from 'vitest';

describe('menuRevealStyle', () => {
  describe('when isOpen is true', () => {
    it('returns opacity 1', () => {
      const style = menuRevealStyle(true);
      expect(style.opacity).toBe(1);
    });

    it('uses 150ms ease-out transition for both opacity and transform', () => {
      const style = menuRevealStyle(true);
      expect(style.transition).toBe(
        'opacity 150ms ease-out, transform 150ms ease-out',
      );
    });

    it('uses scale(1) as the default open transform', () => {
      const style = menuRevealStyle(true);
      expect(style.transform).toBe('scale(1)');
    });

    it('uses a custom openTransform when provided', () => {
      const style = menuRevealStyle(true, 'translateY(0)');
      expect(style.transform).toBe('translateY(0)');
    });
  });

  describe('when isOpen is false', () => {
    it('returns opacity 0', () => {
      const style = menuRevealStyle(false);
      expect(style.opacity).toBe(0);
    });

    it('uses 100ms ease-in transition for both opacity and transform', () => {
      const style = menuRevealStyle(false);
      expect(style.transition).toBe(
        'opacity 100ms ease-in, transform 100ms ease-in',
      );
    });

    it('uses scale(0.95) as the default closed transform', () => {
      const style = menuRevealStyle(false);
      expect(style.transform).toBe('scale(0.95)');
    });

    it('uses a custom closedTransform when provided', () => {
      const style = menuRevealStyle(false, 'scale(1)', 'translateY(-4px)');
      expect(style.transform).toBe('translateY(-4px)');
    });
  });
});

/**
 * One constant's own output, from the utilities layer alone.
 *
 * Tailwind's preflight and `@property` blocks name `box-shadow` whatever is
 * compiled, so a whole-sheet assertion about it would pass on boilerplate
 * rather than on what the constant emits.
 */
async function compileUtilities(constant: string): Promise<string> {
  const css = await compileClasses(constant.split(' '));
  const start = css.indexOf('@layer utilities {');
  return css.slice(start, css.indexOf('\n}', start));
}

/*
 * Compiled declarations, not substrings. The suite this replaced asserted
 * that FOCUS_RING contained `focus-visible:outline-none` and
 * `forced-colors:focus-visible:outline-2`, and passed for months while that
 * exact pairing compiled to nothing: the first sets `--tw-outline-style:
 * none` and the second resolves `outline-style` through it, so the fallback
 * it claimed to pin was inert. A substring check cannot see that.
 */
describe('FOCUS_RING', () => {
  it('paints an outline rather than a ring', async () => {
    const css = await compileUtilities(FOCUS_RING);
    expect(css).toContain('outline-width: 2px');
    expect(css).toContain('outline-offset: 2px');
    expect(css).toContain('outline-color: var(--focus-ring)');
  });

  // .border-shadow writes box-shadow too, so a ring on it is discarded
  it('writes no box-shadow, which an elevation shadow could overwrite', async () => {
    const css = await compileUtilities(FOCUS_RING);
    expect(css).not.toContain('box-shadow');
  });

  it('never suppresses outline-style, which would strand outline-width', async () => {
    const css = await compileUtilities(FOCUS_RING);
    expect(css).not.toContain('--tw-outline-style: none');
    expect(css).not.toContain('outline-style: none');
  });

  it('keeps the outline in forced-colors, where a color token means nothing', async () => {
    const css = await compileUtilities(FOCUS_RING);
    const forcedColors = css.slice(css.indexOf('@media (forced-colors'));
    expect(forcedColors).toContain('outline-color: Highlight');
  });
});

/*
 * The flush variant exists because the offset the shared constant carries
 * is load-bearing on a filled control and pure cost on an input. An input's
 * fill is pinned against --focus-ring by the bundle contract, so the band
 * can sit where the border was, which is where it sat before it was an
 * outline at all.
 */
describe('FOCUS_RING_FLUSH', () => {
  it('sits the band where the border was, not clear of it', async () => {
    const css = await compileUtilities(FOCUS_RING_FLUSH);
    expect(css).toContain('outline-width: 2px');
    expect(css).toContain('outline-offset: 0px');
    expect(css).toContain('outline-color: var(--focus-ring)');
  });

  // erasing the border is a separate opt-in, spelled at the call site
  it('leaves the border alone, which some controls need kept', async () => {
    const css = await compileUtilities(FOCUS_RING_FLUSH);
    expect(css).not.toContain('border-color: transparent');
  });

  it('writes no box-shadow, which an elevation shadow could overwrite', async () => {
    const css = await compileUtilities(FOCUS_RING_FLUSH);
    expect(css).not.toContain('box-shadow');
  });

  it('never suppresses outline-style, which would strand outline-width', async () => {
    const css = await compileUtilities(FOCUS_RING_FLUSH);
    expect(css).not.toContain('--tw-outline-style: none');
    expect(css).not.toContain('outline-style: none');
  });

  it('keeps the outline in forced-colors, where a color token means nothing', async () => {
    const css = await compileUtilities(FOCUS_RING_FLUSH);
    const forcedColors = css.slice(css.indexOf('@media (forced-colors'));
    expect(forcedColors).toContain('outline-color: Highlight');
  });
});

describe('DISABLED', () => {
  it('contains disabled:opacity-60', () => {
    expect(DISABLED).toContain('disabled:opacity-60');
  });

  it('contains disabled:cursor-not-allowed', () => {
    expect(DISABLED).toContain('disabled:cursor-not-allowed');
  });
});

/** The selector of the compiled rule carrying a given declaration. */
function selectorDeclaring(css: string, declaration: string): string {
  const escaped = declaration.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`([^{}]+)\\{[^{}]*${escaped}`));
  return match === null ? '' : match[1].trim();
}

/*
 * A control refused while its own request is in flight and a control that
 * is simply unavailable read as the same thing under one dim, and only the
 * second gets it here. That is a house rule above the floor, not the
 * criterion: 1.4.3's inactive-component exception turns on whether a
 * component is operable, and no `aria-disabled` site in this repo leaves
 * one that way, so the exception covers both. What the split answers to
 * is the measured cost, in
 * `theme/styles/ariaDisabledDim.contrast.test.ts`.
 *
 * The assertions are about which elements each rule can match, not about
 * which rule wins. A busy control matches no rule that dims it, so the
 * split survives Tailwind reordering the sheet.
 */
describe('ARIA_DISABLED', () => {
  it('dims a control refused with no reason given', async () => {
    const css = await compileUtilities(ARIA_DISABLED);
    expect(selectorDeclaring(css, 'opacity: 60%')).toContain(
      '[aria-disabled="true"]',
    );
  });

  it('cannot dim a control that reports itself busy', async () => {
    const css = await compileUtilities(ARIA_DISABLED);
    expect(selectorDeclaring(css, 'opacity: 60%')).toContain(
      ':not([data-busy])',
    );
  });

  it('cannot dim a control refused by a cooldown', async () => {
    const css = await compileUtilities(ARIA_DISABLED);
    expect(selectorDeclaring(css, 'opacity: 60%')).toContain(
      ':not([data-cooldown])',
    );
  });

  it('cannot dim a control the user has focused, outline and all', async () => {
    const css = await compileUtilities(ARIA_DISABLED);
    expect(selectorDeclaring(css, 'opacity: 60%')).toContain(
      ':not(:focus-visible)',
    );
  });

  it('holds the refusal cursor over a cooldown, which has nothing in flight', async () => {
    const css = await compileUtilities(ARIA_DISABLED);
    const selector = selectorDeclaring(css, 'cursor: not-allowed');
    expect(selector).toContain('[aria-disabled="true"]');
    expect(selector).not.toContain(':not([data-cooldown])');
  });

  it('gives a busy control the progress cursor and not the refusal one', async () => {
    const css = await compileUtilities(ARIA_DISABLED);
    expect(selectorDeclaring(css, 'cursor: progress')).toContain('[data-busy]');
    expect(selectorDeclaring(css, 'cursor: not-allowed')).toContain(
      ':not([data-busy])',
    );
  });
});
