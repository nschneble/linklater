/**
 * The statement half of `import-identifier-order`: which order the import
 * declarations themselves take within a group.
 *
 * Split out alongside the specifier half so the rule file states what the
 * rule is and each half states how it works. The two halves share nothing
 * but the comparison, and the statement half needs all of the group, block,
 * and run machinery that the specifier half needs none of.
 */

import { compareIdentifiers } from './compare-identifiers.mjs';
import {
  containsFileLevelDirective,
  forEachImportGroup,
  makeGetBlock,
} from './import-groups.mjs';
import { specifierIdentifier } from './import-specifiers.mjs';

/**
 * The first identifier an import binds, reading left to right: the default
 * binding, the namespace alias, or the first named specifier. A renamed
 * import (`{ alpha as zulu }`) sorts under `alpha`, the name actually
 * written first. Returns null for a side-effect import, which binds nothing.
 */
function firstIdentifier(node) {
  const specifier = node.specifiers[0];
  if (!specifier) {
    return null;
  }
  if (specifier.type === 'ImportSpecifier') {
    return specifierIdentifier(specifier);
  }
  return specifier.local.name;
}

/**
 * Maximal runs of adjacent imports that may be sorted against each other:
 * same import kind, no side-effect import between them.
 */
function sortableRuns(group) {
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
}

function sortRun(run) {
  return run
    .map((node, index) => ({ node, index }))
    .sort((first, second) => {
      const order = compareIdentifiers(
        firstIdentifier(first.node),
        firstIdentifier(second.node),
      );
      // stable: equal identifiers keep their authored order
      return order === 0 ? first.index - second.index : order;
    });
}

/**
 * Reports each unsorted run of import declarations in the program.
 *
 * A run holding a file-level directive is reported without a fix: the fix
 * rewrites the run as one span, which would swallow a comment that no
 * import may carry.
 */
export function checkImportStatementOrder(context, program) {
  const sourceCode = context.sourceCode;
  const getBlock = makeGetBlock(sourceCode);

  const checkRun = (run) => {
    if (run.length < 2) {
      return;
    }

    const sorted = sortRun(run);
    const firstWrong = sorted.findIndex(
      (entry, position) => entry.index !== position,
    );
    if (firstWrong === -1) {
      return;
    }

    const blocks = run.map(getBlock);
    const orderedText = sorted
      .map((entry) => blocks[entry.index].text)
      .join('\n');
    const runStart = blocks[0].start;
    const runEnd = blocks[blocks.length - 1].end;
    const isFixable = !containsFileLevelDirective(sourceCode, runStart, runEnd);

    // one report per run: a swap is a single ordering mistake, and naming
    // both ends of it says more than flagging each moved line separately
    context.report({
      node: sorted[firstWrong].node,
      messageId: 'unsortedImports',
      data: {
        identifier: firstIdentifier(sorted[firstWrong].node),
        predecessor: firstIdentifier(run[firstWrong]),
      },
      fix: isFixable
        ? (fixer) => fixer.replaceTextRange([runStart, runEnd], orderedText)
        : undefined,
    });
  };

  forEachImportGroup(program, sourceCode, (group) => {
    for (const run of sortableRuns(group)) {
      checkRun(run);
    }
  });
}
