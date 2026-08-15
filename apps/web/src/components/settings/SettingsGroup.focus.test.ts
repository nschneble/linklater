/*
 * A settings card carries two indicators on one property. The active
 * section draws a 3px outline flush to its edge; focus draws its own on top.
 * They cannot be told apart by colour: `--focus-ring` is byte-identical to
 * `--base-highlight` in eleven of the twenty theme cascades, so in those a
 * focused active card and an unfocused one resolve to the same hex.
 *
 * The offset is what separates them, which is why this one control keeps
 * the offset variant while every other bordered control went flush. Setting
 * it flush renders the two states pixel-identical and fails SC 2.4.7 — the
 * change looks like tidying and is a conformance regression, so it needs a
 * test that says no rather than a comment that asks nicely.
 */

import { compileClasses } from '../../../test/tailwind';
import { describe, expect, it } from 'vitest';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'SettingsGroup.tsx'),
  'utf8',
);

function offsetOf(css: string): string | undefined {
  return /outline-offset:\s*([^;]+);/.exec(css)?.[1];
}

describe('the settings card focus indicator', () => {
  it('keeps focus at a different offset from the active-section outline', async () => {
    expect(SOURCE).toContain('focus-visible:outline-offset-2');
    const active = await compileClasses(['outline-[3px]']);
    const focused = await compileClasses(['focus-visible:outline-offset-2']);
    expect(offsetOf(active)).not.toBe(offsetOf(focused));
  });

  it('never takes the flush variant, which would collapse the two', () => {
    expect(SOURCE).not.toContain('FOCUS_RING_FLUSH');
    expect(SOURCE).not.toContain('focus-visible:outline-offset-0');
  });
});
