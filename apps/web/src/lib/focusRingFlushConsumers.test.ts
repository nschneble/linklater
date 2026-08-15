/*
 * Who may sit the focus band flush.
 *
 * `FOCUS_RING_FLUSH` erases the control's border for as long as it has
 * focus, and puts the band's inner edge against the fill. That is only safe
 * where the bundle contract pins `--focus-ring` against that fill AND the
 * border carries no state of its own. Both clauses are real: the theme
 * editor's hex row turns its border alert-coloured on an invalid value, so
 * erasing it would hide the refusal exactly while the user is typing one,
 * and the bundle tab fills from `--mount-text` when selected, which the
 * contract does not pin the ring against.
 *
 * A bounded allowlist rather than a scan for correctness: the rule lives in
 * a docstring, and without this it is only a suggestion. Same shape as
 * `chrome-token-migration.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync } from 'node:fs';
import { readFileSync } from 'node:fs';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Text-entry inputs whose fill is pinned and whose border holds no state. */
const ALLOWED = [
  'components/common/FormInput.tsx',
  'components/links/LinksToolbar.tsx',
];

function sourcesNaming(symbol: string): string[] {
  return globSync('**/*.{ts,tsx}', { cwd: SOURCE_ROOT })
    .filter((path) => !path.endsWith('.test.ts') && !path.endsWith('.test.tsx'))
    .filter((path) => path !== 'lib/styles.ts')
    .filter((path) =>
      readFileSync(join(SOURCE_ROOT, path), 'utf8').includes(symbol),
    );
}

describe('FOCUS_RING_FLUSH consumers', () => {
  it('is used by the allowlisted inputs and nothing else', () => {
    expect(sourcesNaming('FOCUS_RING_FLUSH').sort()).toEqual(ALLOWED.sort());
  });

  it('leaves the hex row on the offset variant, its border being stateful', () => {
    const hexRow = readFileSync(
      join(SOURCE_ROOT, 'components/settings/ThemeEditor/ColorRow.tsx'),
      'utf8',
    );
    expect(hexRow).toContain('aria-invalid:border-[var(--alert-border)]');
    expect(hexRow).not.toContain('FOCUS_RING_FLUSH');
  });
});
