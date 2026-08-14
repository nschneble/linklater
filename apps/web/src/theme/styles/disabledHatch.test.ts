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
 * Some of these controls are operable: `aria-disabled` does not block
 * clicks, and the codebase relies on that. So this is 1.4.3 for the ones a
 * user can still activate, not merely a nicety under the inactive-component
 * exception — which is also why the hatch is no longer gated behind CVD
 * mode. The controls it lands on carry no opacity dimming of their own any
 * more, so the stripes keep their measured contrast without the rule having
 * to force an opacity.
 */

import { compileIndexCss } from '../../../test/tailwind';
import { describe, expect, it } from 'vitest';

async function disabledRule(): Promise<string> {
  const css = await compileIndexCss([]);
  const start = css.indexOf(':disabled,');
  return css.slice(start, css.indexOf('\n}', start));
}

describe('the disabled hatch', () => {
  it('reaches every user, not only the ones in CVD mode', async () => {
    const rule = await disabledRule();
    expect(rule).not.toContain("[data-cvd='on']");
    expect(rule).toContain("[aria-disabled='true']");
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

  /*
   * A hidden IconButton is `disabled` and `opacity-0` at once. The rule is
   * unlayered, so an `opacity: 1` here would outrank that utility and paint
   * every hidden button back into view.
   */
  it('forces no opacity, which a hidden control sets to zero', async () => {
    expect(await disabledRule()).not.toContain('opacity');
  });
});
