/**
 * Convergence tests for the two local import rules.
 *
 * `import-identifier-order` and `type-imports-after-value` both rewrite the
 * same import block, and one of them can change the other's input: sorting
 * the names inside the braces changes which identifier a statement sorts
 * under, so a fix at the inner level reopens the outer question. That is
 * only safe if the pair has a fixed point and reaches it.
 *
 * Three claims are asserted on every input. Repeated fixing settles, the
 * settled text is stable under another round, and the settled text reports
 * nothing from either rule. Then each rule is driven to its own fixed point
 * alone and the other is run against the result, in both orders, to show
 * neither undoes the other's work and both orders land in the same place.
 *
 * `verifyAndFix` gives up after ten passes and returns whatever is left
 * unfixed, so an input that failed to settle would surface as a leftover
 * message rather than as a hang.
 */

import { deepStrictEqual, strictEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';
import identifierOrder from './import-identifier-order.mjs';
import { Linter } from 'eslint';
import tseslint from 'typescript-eslint';
import typeImportsAfterValue from './type-imports-after-value.mjs';

const linter = new Linter();

const configFor = (ruleNames) => ({
  files: ['**/*.ts'],
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  linterOptions: { reportUnusedDisableDirectives: 'off' },
  plugins: {
    local: {
      rules: {
        'import-identifier-order': identifierOrder,
        'type-imports-after-value': typeImportsAfterValue,
      },
    },
  },
  rules: Object.fromEntries(
    ruleNames.map((name) => [`local/${name}`, 'error']),
  ),
});

const BOTH = ['import-identifier-order', 'type-imports-after-value'];

const fixWith = (code, ruleNames) =>
  linter.verifyAndFix(code, configFor(ruleNames), { filename: 'input.ts' });

const messagesFor = (code, ruleNames) =>
  linter.verify(code, configFor(ruleNames), { filename: 'input.ts' });

const lines = (...text) => text.join('\n');

const cases = [
  {
    name: 'a block where both rules and the inner sort all have something to say',
    input: lines(
      "import type { Zebra, Alpha } from 'kinds';",
      "import { yak, badger } from 'animals';",
      "import { alpha } from 'alpha';",
    ),
    settled: lines(
      "import { alpha } from 'alpha';",
      "import { badger, yak } from 'animals';",
      "import type { Alpha, Zebra } from 'kinds';",
    ),
    remaining: [],
  },
  {
    name: 'an inner sort that changes which identifier the statement sorts under',
    input: lines(
      "import { zebra, type Beta, alpha } from 'mixed';",
      "import { badger } from 'badger';",
    ),
    settled: lines(
      "import { alpha, zebra, type Beta } from 'mixed';",
      "import { badger } from 'badger';",
    ),
    remaining: [],
  },
  {
    name: 'a file-level directive holds both statement fixes and settles unfixed',
    input: lines(
      "import type { Kind } from 'kind';",
      "import { zebra } from 'zebra';",
      '/* eslint-disable no-console */',
      "import { alpha } from 'alpha';",
    ),
    settled: null,
    remaining: ['typeBeforeValue', 'unsortedImports'],
  },
];

describe('local import rules converge', () => {
  for (const testCase of cases) {
    const settled = testCase.settled ?? testCase.input;

    it(`settles: ${testCase.name}`, () => {
      strictEqual(fixWith(testCase.input, BOTH).output, settled);
    });

    it(`stays settled: ${testCase.name}`, () => {
      const second = fixWith(settled, BOTH);
      strictEqual(second.fixed, false);
      strictEqual(second.output, settled);
    });

    it(`reports only what it cannot fix: ${testCase.name}`, () => {
      const remaining = messagesFor(settled, BOTH).map(
        (message) => message.messageId,
      );
      deepStrictEqual(remaining, testCase.remaining);
    });

    it(`reaches the same place from either rule first: ${testCase.name}`, () => {
      const [identifierRule, typeRule] = BOTH;
      const identifierFirst = fixWith(
        fixWith(testCase.input, [identifierRule]).output,
        [typeRule],
      ).output;
      const typeFirst = fixWith(fixWith(testCase.input, [typeRule]).output, [
        identifierRule,
      ]).output;

      strictEqual(fixWith(identifierFirst, BOTH).output, settled);
      strictEqual(fixWith(typeFirst, BOTH).output, settled);
    });

    it(`neither rule undoes the other: ${testCase.name}`, () => {
      for (const [first, second] of [BOTH, [...BOTH].reverse()]) {
        const afterFirst = fixWith(testCase.input, [first]).output;
        const afterSecond = fixWith(afterFirst, [second]).output;
        strictEqual(fixWith(afterSecond, [first]).fixed, false);
      }
    });
  }
});
