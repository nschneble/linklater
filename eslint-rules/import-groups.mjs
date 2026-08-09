/**
 * Shared import-grouping helpers for the local import ESLint rules.
 *
 * Both `type-imports-after-value` and `import-identifier-order` rewrite runs
 * of import declarations, and both have to agree on two things: where a group
 * starts and ends, and exactly which text travels with an import when it
 * moves. If the two answers ever drifted apart, the rules would hand each
 * other different text on every autofix pass and never settle, so the answer
 * lives here once.
 *
 * One class of comment is exempt from travelling with an import at all. A
 * file-level directive governs the file from where it sits, not the import
 * it happens to sit above, so carrying it along would silently change what
 * it covers: a hashbang would stop being the first bytes of the file, a
 * type-checker or test-environment pragma would fall below code and stop
 * applying, and a suppression block or license header would shift scope.
 * Such a comment is claimed by no import, and a rule about to rewrite a
 * span containing one declines to fix rather than swallow it.
 */

export const BLANK_LINE = /\n[ \t]*\n/;

/**
 * Comment text that governs the file rather than the import below it.
 *
 * The line-scoped suppressions are deliberately excluded: those really do
 * belong to the statement they sit above and must travel with it.
 */
const FILE_LEVEL_DIRECTIVE =
  /^(eslint-(disable|enable)\b(?!-)|eslint-env\b|globals\b|@ts-nocheck\b|@(vitest|jest)-environment\b|@license\b|@preserve\b|SPDX-License-Identifier\b|Copyright\b)/;

export function isFileLevelDirective(comment) {
  if (comment.type === 'Shebang' || comment.type === 'Hashbang') {
    return true;
  }
  return FILE_LEVEL_DIRECTIVE.test(comment.value.replace(/^[\s*]+/, ''));
}

/**
 * True when rewriting `[start, end]` wholesale would move or destroy a
 * file-level directive. A directive above the first import of a run sits
 * outside the span and is unaffected; one between two imports is not, and
 * the caller has to leave that run alone.
 */
export function containsFileLevelDirective(sourceCode, start, end) {
  return sourceCode
    .getAllComments()
    .some(
      (comment) =>
        comment.range[0] >= start &&
        comment.range[1] <= end &&
        isFileLevelDirective(comment),
    );
}

/**
 * Builds the "what text belongs to this import" resolver for a source file.
 *
 * Each comment is claimed exactly once: a leading own-line comment attaches to
 * the import below it, a trailing same-line comment to the import beside it.
 * A blank line breaks the attachment, so a comment separated from an import is
 * left where the author put it.
 */
export function makeGetBlock(sourceCode) {
  // true when the comment starts its own line (leading, not a trailing comment)
  const startsOwnLine = (comment) => {
    const lineStart =
      sourceCode.text.lastIndexOf('\n', comment.range[0] - 1) + 1;
    return sourceCode.text.slice(lineStart, comment.range[0]).trim() === '';
  };

  return (node) => {
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
      if (isFileLevelDirective(comment)) {
        break;
      }
      start = comment.range[0];
    }

    const after = sourceCode.getCommentsAfter(node);
    let end = node.range[1];

    for (const comment of after) {
      const between = sourceCode.text.slice(end, comment.range[0]);

      // a newline ends the decl's line; a comment past it leads the next block
      if (between.includes('\n')) {
        break;
      }
      if (isFileLevelDirective(comment)) {
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
}

/**
 * Splits a Program's body into groups of consecutive import declarations.
 *
 * A blank line is an intentional separator (external packages vs local files),
 * and any non-import statement ends the run, so neither rule ever moves an
 * import across a boundary the author drew.
 */
export function forEachImportGroup(program, sourceCode, visit) {
  let group = [];
  let previousImport = null;

  for (const node of program.body) {
    if (node.type !== 'ImportDeclaration') {
      visit(group);
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
        visit(group);
        group = [];
      }
    }

    group.push(node);
    previousImport = node;
  }

  visit(group);
}
