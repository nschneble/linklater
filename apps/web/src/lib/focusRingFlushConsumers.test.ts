/*
 * Who may erase their own border while focused.
 *
 * This used to guard the flush variant itself, on a rule that tied flush to
 * the control's FILL. That rule measured the wrong edge: the adjacency SC
 * 1.4.11 asks about is the band's outer one, which sits on the host surface
 * at any offset, and every host here is a surface the bundle contract pins
 * `--focus-ring` against. Flush is a perceptual choice, not a contrast one,
 * so a dozen-odd controls take it and the list stopped being interesting.
 *
 * Erasing the border is the clause that carries real risk, and it has two
 * consumers. A control whose border carries state — the theme editor's hex
 * row turns its border alert-coloured on an invalid value — would blank
 * that state for as long as it had focus.
 */

import { describe, expect, it } from 'vitest';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globSync, readFileSync } from 'node:fs';

const SOURCE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ERASE = 'focus-visible:border-transparent';

/** Text-entry inputs whose old treatment already put the band on the border. */
const ALLOWED = [
  'components/common/FormInput.tsx',
  'components/links/LinksToolbar.tsx',
];

describe('erasing a border while focused', () => {
  it('happens in the allowlisted inputs and nowhere else', () => {
    const found = globSync('**/*.{ts,tsx}', { cwd: SOURCE_ROOT })
      .filter((path) => !path.includes('.test.'))
      .filter((path) =>
        readFileSync(join(SOURCE_ROOT, path), 'utf8').includes(ERASE),
      );
    expect(found.sort()).toEqual(ALLOWED.sort());
  });

  it('is spelled at the call site, not hidden in the shared constant', () => {
    const styles = readFileSync(join(SOURCE_ROOT, 'lib/styles.ts'), 'utf8');
    expect(styles).not.toContain(ERASE);
  });
});
