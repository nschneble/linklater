/**
 * Local ESLint rule: sort imports by the first identifier they bind, and
 * sort the named specifiers inside each one.
 *
 * Encodes the project convention (see `.claude/CLAUDE.md`, React Patterns):
 * "Sort imports alphabetically - within individual imports + across import
 * list", whose worked example orders `StumbleEmptyView`, `stumbleLink`,
 * `useEffect` - by identifier, not by module path.
 *
 * The two halves report separately, so lint output says which of the two a
 * developer tripped. They also settle against each other: sorting the names
 * inside the braces can change which identifier a statement sorts under, so
 * ESLint's fix loop applies the inner fix and then re-sorts the statements.
 * Each half has a single fixed point, and neither depends on the other's
 * output for its own, so the loop terminates well inside ESLint's pass cap.
 *
 * Rationale for a hand-authored rule: no off-the-shelf plugin can express
 * this. `eslint-plugin-simple-import-sort` and `eslint-plugin-perfectionist`
 * sort by module path only, and core `sort-imports` checks identifier order
 * but its declaration sort is not autofixable, which would leave every
 * offending file to be corrected by hand.
 *
 * Four things are deliberately never reordered:
 *
 * - Anything across a blank line or a non-import statement. Those are group
 *   boundaries the author drew (see `import-groups.mjs`).
 * - Side-effect imports (`import './polyfill'`). They bind no identifier, and
 *   unlike type-only imports their evaluation order is observable, so they act
 *   as barriers rather than being sorted into place.
 * - Value imports against type imports. That partition belongs to the sibling
 *   `type-imports-after-value` rule; this rule sorts within each run of the
 *   same import kind, so the two converge instead of fighting. Inside the
 *   braces the same partition holds, and this rule owns it there.
 * - A default binding or namespace alias, which is not a named specifier and
 *   always comes first in the braces-bearing forms that allow one at all.
 *
 * A run holding a file-level directive is reported but not fixed, since the
 * whole-run rewrite would swallow a comment that governs the file.
 *
 * Each half lives in its own module. Together they were past the size the
 * project refactors at, and they share nothing but a comparison, so the
 * file that says what the rule is no longer also says how it works.
 */

import { checkImportStatementOrder } from './import-statement-order.mjs';
import { checkNamedSpecifierOrder } from './import-specifiers.mjs';

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Sort imports alphabetically by the first identifier they bind, within each import group, and sort the named specifiers inside each import.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      unsortedImports:
        'Imports must be sorted alphabetically by their first imported identifier. Move `{{identifier}}` above `{{predecessor}}`.',
      unsortedSpecifiers:
        'Named imports must be sorted alphabetically, value specifiers before type specifiers. Move `{{identifier}}` above `{{predecessor}}`.',
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        checkNamedSpecifierOrder(context, node);
      },

      Program(program) {
        checkImportStatementOrder(context, program);
      },
    };
  },
};

export default rule;
