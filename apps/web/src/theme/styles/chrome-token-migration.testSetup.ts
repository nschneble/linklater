// tripwire: migrated chrome files use no legacy pre-bundle css variables
// list a migrated file in .auth, .settings, or .other by component folder

import { describe, expect, it } from 'vitest';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// --focus-ring is excluded: it's a universal slot, not a legacy alias
const LEGACY_TOKENS = [
  'var(--text)',
  'var(--text-muted)',
  'var(--text-subtle)',
  'var(--bg)',
  'var(--bg-surface)',
  'var(--bg-elevated)',
  'var(--bg-input)',
  'var(--border)',
  'var(--accent)',
  'var(--accent-fg)',
  'var(--accent-hover)',
] as const;

export function describeMigratedFiles(migratedFiles: readonly string[]) {
  const fileCases = migratedFiles.map((relativePath) => ({
    relativePath,
    source: readFileSync(resolve(ROOT, relativePath), 'utf8'),
  }));

  describe('chrome bundle migration: migrated files contain no pre-bundle CSS variables', () => {
    describe.each(fileCases)('$relativePath', ({ source }) => {
      it.each(LEGACY_TOKENS)('does not reference %s', (token) => {
        expect(source).not.toContain(token);
      });
    });
  });
}
