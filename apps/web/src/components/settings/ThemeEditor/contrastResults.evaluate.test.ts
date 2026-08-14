/*
 * Tests for the composited evaluator: the blend itself, worst-of scoring
 * across several render sites, and the read set the completeness invariant
 * keys off.
 *
 * These fixtures deliberately give different backgrounds different alphas.
 * The suite this replaced set every `-bg` slot to `#ffffff`, which collapsed
 * every multi-site row to one number: no pair ever scored differently on two
 * chains, so the whole worst-of apparatus ran with zero coverage.
 */

import { describe, expect, it } from 'vitest';
import { evaluatePair } from './contrastResults.evaluate';
import { MODAL_SCRIM } from './contrastResults.backdrops';

function resolverFor(values: Record<string, string>) {
  return (token: string) => values[token] ?? '';
}

describe('compositing a translucent surface down its render stack', () => {
  /*
   * Two translucent layers over an opaque page. The shape is the shipped dark
   * seed's: a status background on a near-transparent card on the page.
   *
   * Source-over carries alpha through the stack: `--info-bg` at a=0.878 over
   * `--mount-bg` at a=0.063 leaves a=0.886, which the opaque page then closes
   * to 1, landing on #7f7f7f. Taking the BACKDROP's alpha instead - the CSS
   * `opacity` group flatten, not source-over - drops the accumulated color to
   * 6% and lands on #080808, a surface 15 times darker than the rendered one.
   *
   * `info` renders both directly on the page and inside a card, so the two
   * models disagree about which of those two sites is the WORST as well as
   * about the number: source-over scores the page site, the group flatten
   * scores its own phantom near-black card at 1.05:1.
   */
  const stack = {
    '--info-text': '#000000',
    '--info-bg': '#909090e0',
    '--mount-bg': '#40404010',
    '--base-bg': '#000000',
  };

  it('measures the stack the browser actually paints', () => {
    const evaluation = evaluatePair(
      '--info-text',
      '--info-bg',
      resolverFor(stack),
    );

    expect(evaluation.ratio).toBeCloseTo(5.173, 3);
  });

  it('does not report the group-flattened number', () => {
    const evaluation = evaluatePair(
      '--info-text',
      '--info-bg',
      resolverFor(stack),
    );

    // discarding the backdrop's alpha crushes the in-card site to 1.05:1 and
    // promotes it to worst, reporting a failure the browser never renders
    expect(evaluation.ratio).not.toBeCloseTo(1.049, 3);
    expect(evaluation.backdrop).toEqual(['--base-bg']);
  });

  it('reads the backdrops it consumed, and nothing further', () => {
    const evaluation = evaluatePair(
      '--info-text',
      '--info-bg',
      resolverFor(stack),
    );

    expect([...evaluation.reads].sort()).toEqual([
      '--base-bg',
      '--info-bg',
      '--info-text',
      '--mount-bg',
    ]);
  });
});

describe('worst-of scoring across render sites', () => {
  /*
   * A 50% white card over a black page. On the page the card lands at #808080;
   * inside another card it lands at #c0c0c0. Black text reads 5.32:1 on the
   * first and 11.54:1 on the second, so the two sites genuinely disagree and
   * the reported number has to be the first.
   */
  const divergent = {
    '--mount-text': '#000000',
    '--mount-bg': '#ffffff80',
    '--base-bg': '#000000',
  };

  it('reports the worst site, not the best or an average', () => {
    const evaluation = evaluatePair(
      '--mount-text',
      '--mount-bg',
      resolverFor(divergent),
    );

    expect(evaluation.ratio).toBeCloseTo(5.317, 3);
    expect(evaluation.backdrop).toEqual(['--base-bg']);
  });

  it('reads tokens a better-scoring site consumed too', () => {
    // --mount-bg is a backdrop only on the site that did NOT win. Editing it
    // still moves the reported number by moving which site is worst, so its
    // row has to be in the key set
    const evaluation = evaluatePair(
      '--orbit-text',
      '--orbit-bg',
      resolverFor({
        '--orbit-text': '#000000',
        '--orbit-bg': '#ffffff80',
        '--mount-bg': '#ffffff',
        '--base-bg': '#000000',
      }),
    );

    expect(evaluation.backdrop).toEqual(['--base-bg']);
    expect(evaluation.reads.has('--mount-bg')).toBe(true);
  });
});

describe('an unmeasurable site never suppresses a measured one', () => {
  /*
   * `--orbit-bg` is garbage, so the orbit-hosted alert cannot be measured at
   * all. The other three alert sites composite fine and fail hard. Folding
   * those into a single null - which is what ranking "we could not tell" above
   * a measured number does - would take away the ratio, the failure flag and
   * the inline row note, and drop the roll-up from fail to uncheckable.
   */
  const partiallyUnreadable = {
    '--alert-text': '#7f7f7f',
    '--alert-bg': '#80808080',
    '--orbit-bg': 'not-a-color',
    '--mount-bg': '#ffffff',
    '--base-bg': '#ffffff',
  };

  it('still reports the worst measured ratio', () => {
    const evaluation = evaluatePair(
      '--alert-text',
      '--alert-bg',
      resolverFor(partiallyUnreadable),
    );

    expect(evaluation.ratio).not.toBeNull();
    expect(evaluation.ratio!).toBeLessThan(4.5);
  });

  it('counts the sites it could not measure alongside it', () => {
    const evaluation = evaluatePair(
      '--alert-text',
      '--alert-bg',
      resolverFor(partiallyUnreadable),
    );

    expect(evaluation.unmeasurable).toBe(1);
    expect(evaluation.unresolved.has('--orbit-bg')).toBe(true);
  });

  it('reports null only when no site measured', () => {
    const evaluation = evaluatePair(
      '--base-text',
      '--base-bg',
      resolverFor({ '--base-text': '#000000', '--base-bg': '#ffffff0d' }),
    );

    // --base-bg is the root of every chain: nothing sits behind the page
    expect(evaluation.ratio).toBeNull();
    expect(evaluation.unmeasurable).toBe(2);
  });
});

describe('an opaque palette short-circuits to its two endpoints', () => {
  const opaque = {
    '--mount-text': '#000000',
    '--mount-bg': '#ffffff',
    '--base-bg': '#123456',
  };

  it('reads neither backdrop, so keying is unchanged from two endpoints', () => {
    const evaluation = evaluatePair(
      '--mount-text',
      '--mount-bg',
      resolverFor(opaque),
    );

    expect([...evaluation.reads].sort()).toEqual([
      '--mount-bg',
      '--mount-text',
    ]);
    expect(evaluation.ratio).toBeCloseTo(21, 5);
    expect(evaluation.unmeasurable).toBe(0);
  });
});

/*
 * The modal scrim. Every overlay paints a 50%-black layer between the page
 * and its panel, and that layer is a literal in a Tailwind utility rather
 * than a token, so a chain of token names could not express it. A
 * translucent orbit panel therefore composited straight onto the page and
 * the editor reported a number no dialog renders.
 *
 * The fixture is the shipped before-midnight light palette with its own
 * orbit background taken to 20% alpha, which is a palette a user can build
 * in the editor today. In light mode the omitted scrim always flatters the
 * result, so the failure direction is a pass reported over a real failure.
 */
describe('an orbit surface inside a dialog', () => {
  const beforeMidnightLight = {
    '--orbit-text': '#20303d',
    '--orbit-bg': '#e3d9b933',
    '--base-bg': '#ccc095',
  };

  it('composites the panel through the scrim, not straight onto the page', () => {
    const evaluation = evaluatePair(
      '--orbit-text',
      '--orbit-bg',
      resolverFor(beforeMidnightLight),
    );
    expect(evaluation.ratio).toBeCloseTo(3.07, 1);
  });

  it('scores the dialog, which is worse than the same panel on the page', () => {
    const evaluation = evaluatePair(
      '--orbit-text',
      '--orbit-bg',
      resolverFor(beforeMidnightLight),
    );
    expect(evaluation.ratio).toBeLessThan(4.5);
  });
});

/*
 * The ten shipped themes declare every background as opaque hex, so
 * `flatten` breaks before it reads a single backdrop and every chain
 * collapses to the same number. That is what makes adding a chain safe: it
 * can only move a palette that was already being measured wrongly.
 */
describe('adding a render site to an opaque palette', () => {
  const opaque = {
    '--orbit-text': '#20303d',
    '--orbit-bg': '#e3d9b9',
    '--base-bg': '#ccc095',
  };

  it('reads neither the page nor anything under it', () => {
    const evaluation = evaluatePair(
      '--orbit-text',
      '--orbit-bg',
      resolverFor(opaque),
    );
    expect([...evaluation.reads].sort()).toEqual([
      '--orbit-bg',
      '--orbit-text',
    ]);
  });

  it('measures every site, so none of them is a dash', () => {
    const evaluation = evaluatePair(
      '--orbit-text',
      '--orbit-bg',
      resolverFor(opaque),
    );
    expect(evaluation.unmeasurable).toBe(0);
  });
});

/*
 * The completeness invariant keys a row's note off the tokens the
 * measurement consumed, so an edit to one token can only move pairs that
 * declared it. A literal is editable by nobody, and keying it would invent
 * a row that does not exist.
 */
describe('the read set with a literal layer in the chain', () => {
  const evaluation = evaluatePair(
    '--orbit-text',
    '--orbit-bg',
    resolverFor({
      '--orbit-text': '#20303d',
      '--orbit-bg': '#e3d9b933',
      '--mount-bg': '#d8cfa9',
      '--base-bg': '#ccc095',
    }),
  );

  it('keys nothing but token names', () => {
    const foreign = [...evaluation.reads].filter(
      (read) => !read.startsWith('--'),
    );
    expect(foreign).toEqual([]);
  });

  it('keys neither the literal colour nor the class that paints it', () => {
    expect(evaluation.reads).not.toContain(MODAL_SCRIM.color);
    expect(evaluation.reads).not.toContain(MODAL_SCRIM.className);
  });

  it('still keys the page background the scrim sits on', () => {
    expect(evaluation.reads).toContain('--base-bg');
  });
});
