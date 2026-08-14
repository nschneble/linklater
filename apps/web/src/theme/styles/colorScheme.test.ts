/*
 * `color-scheme` reaches the canvas, scrollbars and native form widgets only
 * from the root element, and no stylesheet declared it. The one place it
 * appeared was a `[color-scheme:dark]` variant on the two public page roots,
 * which are `<div>`s — those can style widgets inside their own subtree but
 * can never reach the UA chrome. So every theme rendered light scrollbars
 * and light date pickers in dark mode.
 *
 * `data-mode` already sits on `<html>` for the theme cascade, which is the
 * attribute this keys off.
 */

import { compileIndexCss } from '../../../test/tailwind';
import { describe, expect, it } from 'vitest';

describe('color-scheme', () => {
  it('follows the mode attribute the theme cascade already sets', async () => {
    const css = await compileIndexCss([]);
    expect(css).toContain("[data-mode='dark'] {\n  color-scheme: dark;");
    expect(css).toContain("[data-mode='light'] {\n  color-scheme: light;");
  });
});
