/*
 * The scrim's colour is written twice: once in the `scrim` utility that
 * paints it, once as a constant the checker composites through. It has to
 * be, because the checker resolves tokens from the editor's own record of
 * editable values rather than by reading CSS, so a custom property would
 * never reach it.
 *
 * Two sources of truth are only safe while something binds them, which is
 * what this does. Without it the constant is free to drift from the layer it
 * claims to model, and the checker would go back to reporting a number the
 * screen does not render — the exact defect it was added to fix.
 */

import { compileIndexCss } from '../../../../test/tailwind';
import { describe, expect, it } from 'vitest';
import { MODAL_SCRIM } from './contrastResults.backdrops';
import { parseColor } from '../../../theme/colorMath';

describe('the scrim constant', () => {
  it('matches the colour the scrim utility actually paints', async () => {
    const css = await compileIndexCss([MODAL_SCRIM.className]);
    const rule = css.slice(css.indexOf(`.${MODAL_SCRIM.className} {`));
    const painted = /background-color:\s*([^;]+);/.exec(rule)?.[1];
    expect(painted).toBeDefined();
    expect(parseColor(painted as string)).toEqual(
      parseColor(MODAL_SCRIM.color),
    );
  });
});
