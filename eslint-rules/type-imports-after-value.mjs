/**
 * Local ESLint rule: require declaration-level `import type { ... }` statements
 * to appear after value `import` statements within the same import group.
 *
 * Encodes the project convention (see `.claude/CLAUDE.md`, React Patterns):
 * "Put `import {}` before `import type {}`."
 *
 * An "import group" is a run of consecutive `import` declarations with no blank
 * line between them. A blank line is treated as an intentional group separator
 * (e.g. external packages vs. local files), so each blank-line-separated group
 * is partitioned independently and a group boundary is never crossed. Any other
 * (non-import) statement also ends the current group.
 *
 * The autofix performs a stable partition within a single group: value imports
 * keep their relative order, type imports keep their relative order, and the
 * type imports are moved as a block below the value imports. Each import moves
 * together with the leading own-line comments attached to it and any trailing
 * comment on its own line, so a comment describing a type import stays with
 * that import rather than being stranded on a neighbour or dropped. The whole
 * group is rewritten in one fix, so the reorder settles in a single autofix
 * pass regardless of how many type imports are misplaced.
 *
 * Because type-only declarations are elided at compile time, moving them
 * relative to value imports never changes runtime behavior.
 *
 * Rationale for a hand-authored rule over an off-the-shelf plugin: none of
 * `eslint-plugin-import`, `eslint-plugin-simple-import-sort`, `perfectionist`,
 * or `@typescript-eslint/consistent-type-imports` is installed, and none can
 * express this narrow "value before type, order otherwise untouched" constraint
 * without also re-sorting imports by module path, which is churn this repo does
 * not want. A small local rule avoids pulling in a broad import-sorting
 * dependency for one narrow ordering guarantee.
 *
 * Group detection and comment attachment are shared with
 * `import-identifier-order` via `import-groups.mjs`: both rules rewrite runs of
 * imports, so they have to agree on which text moves with one.
 */

import { forEachImportGroup, makeGetBlock } from './import-groups.mjs';

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Require declaration-level `import type` statements to appear after value imports within the same import group.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      typeBeforeValue:
        'Value imports must come before `import type` declarations. Move this type-only import below the value imports.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const getBlock = makeGetBlock(sourceCode);

    const checkGroup = (group) => {
      if (group.length < 2) {
        return;
      }

      let lastValueIndex = -1;
      for (let index = 0; index < group.length; index++) {
        if (group[index].importKind !== 'type') {
          lastValueIndex = index;
        }
      }

      // a type import before the last value import is misplaced
      const misplaced = [];
      for (let index = 0; index < lastValueIndex; index++) {
        if (group[index].importKind === 'type') {
          misplaced.push(group[index]);
        }
      }

      if (misplaced.length === 0) {
        return;
      }

      const blocks = group.map(getBlock);
      const valueText = blocks.filter(
        (_, index) => group[index].importKind !== 'type',
      );
      const typeText = blocks.filter(
        (_, index) => group[index].importKind === 'type',
      );
      const orderedText = [...valueText, ...typeText]
        .map((block) => block.text)
        .join('\n');
      const groupStart = blocks[0].start;
      const groupEnd = blocks[blocks.length - 1].end;

      // report each misplaced import; attach the single rewrite fix to the first only
      misplaced.forEach((node, reportIndex) => {
        context.report({
          node,
          messageId: 'typeBeforeValue',
          fix:
            reportIndex === 0
              ? (fixer) =>
                  fixer.replaceTextRange([groupStart, groupEnd], orderedText)
              : undefined,
        });
      });
    };

    return {
      Program(program) {
        forEachImportGroup(program, sourceCode, checkGroup);
      },
    };
  },
};

export default rule;
