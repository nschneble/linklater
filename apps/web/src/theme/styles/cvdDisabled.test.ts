/*
 * The disabled hatch is keyed on `:disabled` and `[aria-disabled='true']`,
 * so it cannot know which bundle its host belongs to. It used to paint the
 * stripes in `--base-border` and force the label to `--base-alt-text`, both
 * base-tier tokens, onto controls filled from mount, orbit or alert. The
 * bundle contract pins those two against `--base-bg` and nothing else, so
 * neither pairing was guaranteed on any control this actually hits.
 *
 * `currentColor` resolves to whatever the control already set from its own
 * bundle, which collapses the check onto `text on bg` — a pair the contract
 * pins at 4.5:1 for every bundle. It needs no new contract pairs, and it
 * cannot drift when a bundle is added.
 *
 * `aria-disabled` does not block clicks, and the codebase relies on that,
 * but no site setting it leaves a control operable: each one guards its
 * own handler, is natively disabled besides, or takes no pointer, so
 * 1.4.3's inactive-component exception covers the lot. The 4.5:1 holds
 * on other grounds: the hatch is gated to `[data-cvd='on']`, where
 * `index.css` forces `opacity: 1`, so the pair the contract pins is the
 * pair that renders.
 */

import { compileIndexCss } from '../../../test/tailwind';
import { describe, expect, it } from 'vitest';

async function disabledRule(): Promise<string> {
  const css = await compileIndexCss([]);
  const start = css.indexOf("[data-cvd='on'] :disabled");
  return css.slice(start, css.indexOf('\n}', start));
}

describe('the CVD disabled hatch', () => {
  /*
   * It stays gated. Un-gating it once looked right on the argument that a
   * shape beats a contrast reduction, and shipped stripes across the
   * primary button a user had just successfully pressed. Most controls
   * here that take either attribute take it for a request in flight or a
   * success cooldown, so a treatment that reads as permanently
   * unavailable is the wrong signal for almost every one of them. Gating
   * is what confines it to the users who need a non-colour cue and accept
   * that trade.
   */
  it('reaches only the users who asked for it', async () => {
    const css = await compileIndexCss([]);
    const selectors = [...css.matchAll(/^.*\[aria-disabled='true'\].*$/gm)];
    expect(selectors).not.toHaveLength(0);
    for (const [selector] of selectors) {
      expect(selector).toContain("[data-cvd='on']");
    }
  });

  it('paints in the colour the control already carries', async () => {
    expect(await disabledRule()).toContain('currentColor');
  });

  it('names no base-tier token, which its hosts do not paint from', async () => {
    const rule = await disabledRule();
    expect(rule).not.toContain('--base-border');
    expect(rule).not.toContain('--base-alt-text');
  });

  it('leaves the label the colour its own bundle set', async () => {
    expect(await disabledRule()).not.toContain('color: var(');
  });
});
