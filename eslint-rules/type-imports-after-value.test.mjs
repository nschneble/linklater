/**
 * Tests for the local `type-imports-after-value` ESLint rule.
 *
 * `eslint-rules/` lives at the repo root, outside both workspace test runners
 * (Jest for the API, Vitest for the web app), so this spec runs on Node's
 * built-in test runner and is wired into `scripts/run-tests.mjs` so it executes
 * on every `npm run test`. It exercises the rule's own logic (reporting, the
 * autofix, the `importKind` guard, blank-line group boundaries, and the
 * non-import group reset) rather than relying on a one-time repo-wide autofix.
 */

import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from './type-imports-after-value.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

ruleTester.run('type-imports-after-value', rule, {
  valid: [
    // value import already before the type import
    {
      code: [
        "import { value } from 'value';",
        "import type { Kind } from 'kind';",
      ].join('\n'),
    },
    // single import: nothing to order
    { code: "import type { Kind } from 'kind';" },
    // blank line is a group boundary; not flagged across the boundary
    {
      code: [
        "import { value } from 'value';",
        "import type { Kind } from 'kind';",
        '',
        "import { local } from './local';",
      ].join('\n'),
    },
    // a non-import statement between imports resets the group
    {
      code: [
        "import type { Kind } from 'kind';",
        'const separator = 1;',
        "import { value } from 'value';",
      ].join('\n'),
    },
  ],
  invalid: [
    // a single type import before a value import is reported and fixed
    {
      code: [
        "import type { Kind } from 'kind';",
        "import { value } from 'value';",
      ].join('\n'),
      output: [
        "import { value } from 'value';",
        "import type { Kind } from 'kind';",
      ].join('\n'),
      errors: [{ messageId: 'typeBeforeValue' }],
    },
    // multiple type imports before one value import fix in a single pass
    {
      code: [
        "import type { First } from 'first';",
        "import type { Second } from 'second';",
        "import { value } from 'value';",
      ].join('\n'),
      output: [
        "import { value } from 'value';",
        "import type { First } from 'first';",
        "import type { Second } from 'second';",
      ].join('\n'),
      errors: [
        { messageId: 'typeBeforeValue' },
        { messageId: 'typeBeforeValue' },
      ],
    },
    // a leading own-line comment moves with its type import, not stranded
    {
      code: [
        '// documents the Kind type',
        "import type { Kind } from 'kind';",
        "import { value } from 'value';",
      ].join('\n'),
      output: [
        "import { value } from 'value';",
        '// documents the Kind type',
        "import type { Kind } from 'kind';",
      ].join('\n'),
      errors: [{ messageId: 'typeBeforeValue' }],
    },
    // only the offending group is reordered; a later group is left untouched
    {
      code: [
        "import type { Kind } from 'kind';",
        "import { value } from 'value';",
        '',
        "import { local } from './local';",
      ].join('\n'),
      output: [
        "import { value } from 'value';",
        "import type { Kind } from 'kind';",
        '',
        "import { local } from './local';",
      ].join('\n'),
      errors: [{ messageId: 'typeBeforeValue' }],
    },
    // a trailing same-line comment survives the reorder, not silently deleted
    {
      code: [
        "import type { Kind } from 'kind'; // KEEPME trailing",
        "import { value } from 'value';",
      ].join('\n'),
      output: [
        "import { value } from 'value';",
        "import type { Kind } from 'kind'; // KEEPME trailing",
      ].join('\n'),
      errors: [{ messageId: 'typeBeforeValue' }],
    },
    // same holds for a trailing block comment, incl a lint-suppression comment
    {
      code: [
        "import type { Kind } from 'kind'; /* KEEPME trailing */",
        "import { value } from 'value';",
      ].join('\n'),
      output: [
        "import { value } from 'value';",
        "import type { Kind } from 'kind'; /* KEEPME trailing */",
      ].join('\n'),
      errors: [{ messageId: 'typeBeforeValue' }],
    },
  ],
});
