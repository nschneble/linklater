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
 */

const BLANK_LINE = /\n[ \t]*\n/;

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

    // True when the comment is the first non-whitespace token on its own line
    // (so it is a leading comment rather than a trailing comment on the
    // previous import's line).
    const startsOwnLine = (comment) => {
      const lineStart =
        sourceCode.text.lastIndexOf('\n', comment.range[0] - 1) + 1;
      return sourceCode.text.slice(lineStart, comment.range[0]).trim() === '';
    };

    // The text span that should move with an import: the declaration plus any
    // leading own-line comments directly above it (no blank line between) and
    // any trailing comment on the same line as the declaration's end. Trailing
    // same-line comments and leading own-line comments are mutually exclusive
    // (a comment either shares the preceding import's line or starts its own),
    // so a comment is captured by exactly one block and travels with the import
    // it annotates through the reorder rather than being stranded or deleted.
    const getBlock = (node) => {
      const before = sourceCode.getCommentsBefore(node);
      let start = node.range[0];

      for (let index = before.length - 1; index >= 0; index--) {
        const comment = before[index];
        const between = sourceCode.text.slice(comment.range[1], start);

        if (BLANK_LINE.test(between)) {
          break;
        }
        if (!startsOwnLine(comment)) {
          break;
        }
        start = comment.range[0];
      }

      const after = sourceCode.getCommentsAfter(node);
      let end = node.range[1];

      for (const comment of after) {
        const between = sourceCode.text.slice(end, comment.range[0]);

        // The first newline marks the end of the declaration's own line: any
        // comment beyond it begins its own line and belongs to the next block
        // as a leading comment, not to this one as a trailing comment.
        if (between.includes('\n')) {
          break;
        }
        end = comment.range[1];
      }

      return {
        start,
        end,
        text: sourceCode.text.slice(start, end),
      };
    };

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

      // Every type import positioned before the final value import is misplaced.
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

      // Report every misplaced type import for visibility, but attach the
      // single group-rewriting fix to the first report only so the autofix
      // applies once (no overlapping fixes, no extra passes).
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
        let group = [];
        let previousImport = null;

        for (const node of program.body) {
          if (node.type !== 'ImportDeclaration') {
            checkGroup(group);
            group = [];
            previousImport = null;
            continue;
          }

          if (previousImport) {
            const between = sourceCode.text.slice(
              previousImport.range[1],
              node.range[0],
            );
            if (BLANK_LINE.test(between)) {
              checkGroup(group);
              group = [];
            }
          }

          group.push(node);
          previousImport = node;
        }

        checkGroup(group);
      },
    };
  },
};

export default rule;
