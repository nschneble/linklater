/**
 * Local ESLint rule: sort imports by the first identifier they bind.
 *
 * Encodes the project convention (see `.claude/CLAUDE.md`, React Patterns):
 * "Sort imports alphabetically - within individual imports + across import
 * list", whose worked example orders `StumbleEmptyView`, `stumbleLink`,
 * `useEffect` - by identifier, not by module path.
 *
 * Rationale for a hand-authored rule: no off-the-shelf plugin can express
 * this. `eslint-plugin-simple-import-sort` and `eslint-plugin-perfectionist`
 * sort by module path only, and core `sort-imports` checks identifier order
 * but its declaration sort is not autofixable, which would leave every
 * offending file to be corrected by hand.
 *
 * Three things are deliberately never reordered:
 *
 * - Anything across a blank line or a non-import statement. Those are group
 *   boundaries the author drew (see `import-groups.mjs`).
 * - Side-effect imports (`import './polyfill'`). They bind no identifier, and
 *   unlike type-only imports their evaluation order is observable, so they act
 *   as barriers rather than being sorted into place.
 * - Value imports against type imports. That partition belongs to the sibling
 *   `type-imports-after-value` rule; this rule sorts within each run of the
 *   same import kind, so the two converge instead of fighting.
 */

import { forEachImportGroup, makeGetBlock } from './import-groups.mjs';

/**
 * The first identifier an import binds, reading left to right: the default
 * binding, the namespace alias, or the first named specifier. A renamed
 * import (`{ alpha as zulu }`) sorts under `alpha`, the name actually written
 * first. Returns null for a side-effect import, which binds nothing.
 */
function firstIdentifier(node) {
  const specifier = node.specifiers[0];
  if (!specifier) {
    return null;
  }
  if (specifier.type === 'ImportSpecifier') {
    return specifier.imported?.name ?? specifier.local.name;
  }
  return specifier.local.name;
}

function compareIdentifiers(first, second) {
  return first.localeCompare(second, 'en', { sensitivity: 'base' });
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Sort imports alphabetically by the first identifier they bind, within each import group.',
    },
    fixable: 'code',
    schema: [],
    messages: {
      unsortedImports:
        'Imports must be sorted alphabetically by their first imported identifier. Move `{{identifier}}` above `{{predecessor}}`.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const getBlock = makeGetBlock(sourceCode);

    /**
     * Maximal runs of adjacent imports that may be sorted against each other:
     * same import kind, no side-effect import between them.
     */
    const sortableRuns = (group) => {
      const runs = [];
      let current = [];

      for (const node of group) {
        if (firstIdentifier(node) === null) {
          if (current.length > 0) runs.push(current);
          current = [];
          continue;
        }
        const previous = current[current.length - 1];
        if (previous && previous.importKind !== node.importKind) {
          runs.push(current);
          current = [];
        }
        current.push(node);
      }

      if (current.length > 0) runs.push(current);
      return runs;
    };

    const checkRun = (run) => {
      if (run.length < 2) {
        return;
      }

      const sorted = run
        .map((node, index) => ({ node, index }))
        .sort((first, second) => {
          const order = compareIdentifiers(
            firstIdentifier(first.node),
            firstIdentifier(second.node),
          );
          // stable: equal identifiers keep their authored order
          return order === 0 ? first.index - second.index : order;
        });

      const misplaced = sorted.filter(
        (entry, position) => entry.index !== position,
      );
      if (misplaced.length === 0) {
        return;
      }

      const blocks = run.map(getBlock);
      const orderedText = sorted
        .map((entry) => blocks[entry.index].text)
        .join('\n');
      const runStart = blocks[0].start;
      const runEnd = blocks[blocks.length - 1].end;

      // one report per run: a swap is a single ordering mistake, and naming
      // both ends of it says more than flagging each moved line separately
      const firstWrong = sorted.findIndex(
        (entry, position) => entry.index !== position,
      );
      context.report({
        node: sorted[firstWrong].node,
        messageId: 'unsortedImports',
        data: {
          identifier: firstIdentifier(sorted[firstWrong].node),
          predecessor: firstIdentifier(run[firstWrong]),
        },
        fix: (fixer) => fixer.replaceTextRange([runStart, runEnd], orderedText),
      });
    };

    return {
      Program(program) {
        forEachImportGroup(program, sourceCode, (group) => {
          for (const run of sortableRuns(group)) {
            checkRun(run);
          }
        });
      },
    };
  },
};

export default rule;
