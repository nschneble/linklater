/**
 * Tests for the local `import-identifier-order` ESLint rule.
 *
 * `eslint-rules/` lives at the repo root, outside both workspace test runners,
 * so this spec runs on Node's built-in test runner and is picked up by
 * `scripts/run-tests.mjs` via the `eslint-rules/**\/*.test.mjs` glob.
 *
 * The cases that matter most are the ones where sorting would be WRONG:
 * side-effect imports (whose order is observable), group boundaries the author
 * drew, and the value/type partition the sibling rule owns.
 */

import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import rule from './import-identifier-order.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tseslint.parser,
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

ruleTester.run('import-identifier-order', rule, {
  valid: [
    // the worked example from CLAUDE.md, in its documented order
    {
      code: [
        "import StumbleEmptyView from './StumbleEmptyView';",
        "import { stumbleLink } from '../lib/api';",
        "import { useEffect, useState } from 'react';",
      ].join('\n'),
    },
    // a single import has no order to get wrong
    { code: "import { value } from 'value';" },
    // blank line is a group boundary: each side sorted, across it untouched
    {
      code: [
        "import { alpha } from 'alpha';",
        "import { beta } from 'beta';",
        '',
        "import { aardvark } from './aardvark';",
      ].join('\n'),
    },
    // a non-import statement resets the group
    {
      code: [
        "import { zebra } from 'zebra';",
        'const separator = 1;',
        "import { alpha } from 'alpha';",
      ].join('\n'),
    },
    // value and type runs are sorted independently, not against each other
    {
      code: [
        "import { alpha } from 'alpha';",
        "import { zebra } from 'zebra';",
        "import type { Beta } from 'beta';",
        "import type { Yak } from 'yak';",
      ].join('\n'),
    },
    // a side-effect import has observable order, so it is never moved and
    // nothing is sorted across it: alpha stays below it despite sorting first
    {
      code: [
        "import './polyfill';",
        "import { alpha } from 'alpha';",
        "import { zebra } from 'zebra';",
      ].join('\n'),
    },
    // the barrier holds in the other direction too
    {
      code: [
        "import { zebra } from 'zebra';",
        "import './polyfill';",
        "import { alpha } from 'alpha';",
      ].join('\n'),
    },
    // case is ignored: Stumble* sorts against stumble* by letter, not by case
    {
      code: [
        "import { apple } from 'apple';",
        "import Banana from 'banana';",
        "import { cherry } from 'cherry';",
      ].join('\n'),
    },
    // a renamed import sorts under the name written first
    {
      code: [
        "import { alpha as zulu } from 'alpha';",
        "import { beta } from 'beta';",
      ].join('\n'),
    },
  ],
  invalid: [
    // two value imports in the wrong order
    {
      code: [
        "import { zebra } from 'zebra';",
        "import { alpha } from 'alpha';",
      ].join('\n'),
      output: [
        "import { alpha } from 'alpha';",
        "import { zebra } from 'zebra';",
      ].join('\n'),
      errors: 1,
    },
    // default and namespace imports sort on their bound name
    {
      code: [
        "import Zebra from 'zebra';",
        "import * as alpha from 'alpha';",
      ].join('\n'),
      output: [
        "import * as alpha from 'alpha';",
        "import Zebra from 'zebra';",
      ].join('\n'),
      errors: 1,
    },
    // a renamed import sorts under the imported name, not the local one
    {
      code: [
        "import { zebra as aardvark } from 'zebra';",
        "import { alpha } from 'alpha';",
      ].join('\n'),
      output: [
        "import { alpha } from 'alpha';",
        "import { zebra as aardvark } from 'zebra';",
      ].join('\n'),
      errors: 1,
    },
    // a leading own-line comment travels with its import
    {
      code: [
        '// explains zebra',
        "import { zebra } from 'zebra';",
        "import { alpha } from 'alpha';",
      ].join('\n'),
      output: [
        "import { alpha } from 'alpha';",
        '// explains zebra',
        "import { zebra } from 'zebra';",
      ].join('\n'),
      errors: 1,
    },
    // a trailing same-line comment survives the move
    {
      code: [
        "import { zebra } from 'zebra'; // KEEPME",
        "import { alpha } from 'alpha';",
      ].join('\n'),
      output: [
        "import { alpha } from 'alpha';",
        "import { zebra } from 'zebra'; // KEEPME",
      ].join('\n'),
      errors: 1,
    },
    // the type run sorts on its own, leaving the value run alone
    {
      code: [
        "import { alpha } from 'alpha';",
        "import type { Zebra } from 'zebra';",
        "import type { Beta } from 'beta';",
      ].join('\n'),
      output: [
        "import { alpha } from 'alpha';",
        "import type { Beta } from 'beta';",
        "import type { Zebra } from 'zebra';",
      ].join('\n'),
      errors: 1,
    },
    // only the offending group moves; the group past the blank line does not
    {
      code: [
        "import { zebra } from 'zebra';",
        "import { alpha } from 'alpha';",
        '',
        "import { yak } from './yak';",
        "import { badger } from './badger';",
      ].join('\n'),
      output: [
        "import { alpha } from 'alpha';",
        "import { zebra } from 'zebra';",
        '',
        "import { badger } from './badger';",
        "import { yak } from './yak';",
      ].join('\n'),
      errors: 2,
    },
    // sorting happens on each side of a side-effect import, never across it
    {
      code: [
        "import { zebra } from 'zebra';",
        "import { alpha } from 'alpha';",
        "import './polyfill';",
        "import { yak } from 'yak';",
        "import { badger } from 'badger';",
      ].join('\n'),
      output: [
        "import { alpha } from 'alpha';",
        "import { zebra } from 'zebra';",
        "import './polyfill';",
        "import { badger } from 'badger';",
        "import { yak } from 'yak';",
      ].join('\n'),
      errors: 2,
    },
  ],
});
