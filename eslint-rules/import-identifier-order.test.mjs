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
import rule from './import-identifier-order.mjs';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';

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
    // named specifiers in order, including a default binding that is not one
    { code: "import Alpha, { beta, gamma } from 'alpha';" },
    // inside the braces, value specifiers come before type specifiers
    { code: "import { alpha, zebra, type Beta } from 'alpha';" },
    // a declaration-level type import has no inline kinds to partition
    { code: "import type { Alpha, Zebra } from 'alpha';" },
    // a namespace alias binds no named specifier
    { code: "import * as zebra from 'zebra';" },
    // a lone named specifier has no order to get wrong
    { code: "import { zebra } from 'zebra';" },
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
    // named specifiers sort inside the braces, under their own message
    {
      code: "import { zebra, alpha } from 'alpha';",
      output: "import { alpha, zebra } from 'alpha';",
      errors: [{ messageId: 'unsortedSpecifiers' }],
    },
    // a renamed specifier sorts under the imported name, not the local one
    {
      code: "import { zebra as aardvark, alpha } from 'alpha';",
      output: "import { alpha, zebra as aardvark } from 'alpha';",
      errors: [{ messageId: 'unsortedSpecifiers' }],
    },
    // the inline type modifier survives the move, and sorts after the values
    {
      code: "import { type Beta, alpha, zebra } from 'alpha';",
      output: "import { alpha, zebra, type Beta } from 'alpha';",
      errors: [{ messageId: 'unsortedSpecifiers' }],
    },
    // type specifiers sort among themselves once partitioned
    {
      code: "import { type Zebra, type Alpha } from 'alpha';",
      output: "import { type Alpha, type Zebra } from 'alpha';",
      errors: [{ messageId: 'unsortedSpecifiers' }],
    },
    // a default binding is not a named specifier, so it does not move
    {
      code: "import Zulu, { zebra, alpha } from 'alpha';",
      output: "import Zulu, { alpha, zebra } from 'alpha';",
      errors: [{ messageId: 'unsortedSpecifiers' }],
    },
    // case is ignored inside the braces too
    {
      code: "import { Zebra, alpha } from 'alpha';",
      output: "import { alpha, Zebra } from 'alpha';",
      errors: [{ messageId: 'unsortedSpecifiers' }],
    },
    // rewriting specifier text in place keeps the author's line breaks and
    // the trailing comma exactly where they were
    {
      code: ['import {', '  zebra,', '  alpha,', "} from 'alpha';"].join('\n'),
      output: ['import {', '  alpha,', '  zebra,', "} from 'alpha';"].join(
        '\n',
      ),
      errors: [{ messageId: 'unsortedSpecifiers' }],
    },
    // a comment among the specifiers describes a position, not a name, so the
    // violation is reported and the fix withheld rather than stranding it
    {
      code: [
        'import {',
        '  // explains zebra',
        '  zebra,',
        '  alpha,',
        "} from 'alpha';",
      ].join('\n'),
      output: null,
      errors: [{ messageId: 'unsortedSpecifiers' }],
    },
    // a trailing comment beside a specifier withholds the fix for the same reason
    {
      code: "import { zebra /* keep */, alpha } from 'alpha';",
      output: null,
      errors: [{ messageId: 'unsortedSpecifiers' }],
    },
    // the two halves report separately, so lint output says which was tripped.
    // one pass applies the statement rewrite; the inner fix overlaps it and
    // lands on the next, which the convergence spec covers
    {
      code: [
        "import { zebra, yak } from 'zebra';",
        "import { alpha } from 'alpha';",
      ].join('\n'),
      output: [
        "import { alpha } from 'alpha';",
        "import { zebra, yak } from 'zebra';",
      ].join('\n'),
      errors: [
        { messageId: 'unsortedSpecifiers' },
        { messageId: 'unsortedImports' },
      ],
    },
  ],
});

/**
 * A comment above the first import is normally a note about that import and
 * travels with it. A file-level directive is not: it governs the file from
 * where it sits, so moving it changes what it covers. Before the guard, all
 * five of these were dragged below an import by the autofix.
 */
ruleTester.run('import-identifier-order (file-level directives)', rule, {
  valid: [],
  invalid: [
    {
      code: [
        '// @vitest-environment jsdom',
        "import { zebra } from 'zebra';",
        "import { alpha } from 'alpha';",
      ].join('\n'),
      output: [
        '// @vitest-environment jsdom',
        "import { alpha } from 'alpha';",
        "import { zebra } from 'zebra';",
      ].join('\n'),
      errors: [{ messageId: 'unsortedImports' }],
    },
    {
      code: [
        '// @ts-nocheck',
        "import { zebra } from 'zebra';",
        "import { alpha } from 'alpha';",
      ].join('\n'),
      output: [
        '// @ts-nocheck',
        "import { alpha } from 'alpha';",
        "import { zebra } from 'zebra';",
      ].join('\n'),
      errors: [{ messageId: 'unsortedImports' }],
    },
    {
      code: [
        '/* eslint-disable no-console */',
        "import { zebra } from 'zebra';",
        "import { alpha } from 'alpha';",
      ].join('\n'),
      output: [
        '/* eslint-disable no-console */',
        "import { alpha } from 'alpha';",
        "import { zebra } from 'zebra';",
      ].join('\n'),
      errors: [{ messageId: 'unsortedImports' }],
    },
    {
      code: [
        '/**',
        ' * Copyright 2026 Linklater',
        ' * @license CC0-1.0',
        ' */',
        "import { zebra } from 'zebra';",
        "import { alpha } from 'alpha';",
      ].join('\n'),
      output: [
        '/**',
        ' * Copyright 2026 Linklater',
        ' * @license CC0-1.0',
        ' */',
        "import { alpha } from 'alpha';",
        "import { zebra } from 'zebra';",
      ].join('\n'),
      errors: [{ messageId: 'unsortedImports' }],
    },
    {
      code: [
        '#!/usr/bin/env node',
        "import { zebra } from 'zebra';",
        "import { alpha } from 'alpha';",
      ].join('\n'),
      output: [
        '#!/usr/bin/env node',
        "import { alpha } from 'alpha';",
        "import { zebra } from 'zebra';",
      ].join('\n'),
      errors: [{ messageId: 'unsortedImports' }],
    },
    // between two imports a directive belongs to no block, so the whole-run
    // rewrite would delete it: report, withhold the fix
    {
      code: [
        "import { zebra } from 'zebra';",
        '/* eslint-disable no-console */',
        "import { alpha } from 'alpha';",
      ].join('\n'),
      output: null,
      errors: [{ messageId: 'unsortedImports' }],
    },
    // a line-scoped suppression really does belong to the import below it
    {
      code: [
        '// eslint-disable-next-line no-console',
        "import { zebra } from 'zebra';",
        "import { alpha } from 'alpha';",
      ].join('\n'),
      output: [
        "import { alpha } from 'alpha';",
        '// eslint-disable-next-line no-console',
        "import { zebra } from 'zebra';",
      ].join('\n'),
      errors: [{ messageId: 'unsortedImports' }],
    },
  ],
});
