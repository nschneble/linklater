/**
 * Shared import-grouping helpers for the local import ESLint rules.
 *
 * Both `type-imports-after-value` and `import-identifier-order` rewrite runs
 * of import declarations, and both have to agree on two things: where a group
 * starts and ends, and exactly which text travels with an import when it
 * moves. If the two answers ever drifted apart, the rules would hand each
 * other different text on every autofix pass and never settle, so the answer
 * lives here once.
 */

export const BLANK_LINE = /\n[ \t]*\n/;

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
