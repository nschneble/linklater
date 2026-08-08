/**
 * Local ESLint rule: flag runs of consecutive line comments inside a
 * function body.
 *
 * Encodes the project convention (see `.claude/CLAUDE.md`, Comments): no
 * multi-line comment blocks mid-execution. Longer context belongs in the
 * file or section overview, and a well-named symbol beats a comment. One
 * line saying why a step exists is fine; a stack of them is narration a
 * reader has to wade through before reaching the code.
 *
 * Deliberate non-goals: the rule never inspects block comments or JSDoc,
 * and never weighs comment length or whether a symbol is exported. Both
 * of those axes were evaluated and rejected. A non-exported helper in
 * the theme editor carries a legitimate five-line JSDoc, and plenty of
 * exported symbols are documented with one line comment or with nothing,
 * so neither length nor export status tracks the convention. The real
 * axis is symbol kind, and this rule claims only the slice of it a
 * linter can decide without judgment.
 *
 * A run means line comments on literally adjacent lines, each occupying
 * its own line. A blank line, a statement, or a comment trailing code
 * all break it, since each marks a separate thought rather than a block.
 *
 * Tooling directives are dropped before a run is measured, so a note
 * explaining a lint suppression may sit directly above it. Dropping a
 * directive does not close the gap it leaves: two prose comments on
 * either side of one were never adjacent, and are left alone.
 *
 * Not autofixable. Deleting or rewriting a comment is authoring, not a
 * mechanical transform.
 */

const DIRECTIVE_PREFIXES = [
  'eslint-disable',
  'eslint-enable',
  '@ts-',
  'ts-expect-error',
  'ts-ignore',
  'ts-nocheck',
  'prettier-ignore',
  'istanbul ignore',
  'c8 ignore',
  'v8 ignore',
];

function isDirective(comment) {
  const text = comment.value.trimStart();
  return DIRECTIVE_PREFIXES.some((prefix) => text.startsWith(prefix));
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow runs of consecutive line comments inside a function body.',
    },
    schema: [],
    messages: {
      commentBlockInBody:
        'Longer context belongs in the file or section overview, and a well-named symbol beats a comment.',
    },
  },
  create(context) {
    const sourceCode = context.sourceCode;
    const bodyRanges = [];

    const recordBody = (node) => {
      if (!node.body) {
        return;
      }
      if (node.body.type === 'BlockStatement') {
        bodyRanges.push(node.body.range);
        return;
      }
      // concise arrow body: start at the arrow, not the parameter list
      const arrow = sourceCode.getTokenBefore(
        node.body,
        (token) => token.type === 'Punctuator' && token.value === '=>',
      );
      bodyRanges.push([
        arrow ? arrow.range[1] : node.body.range[0],
        node.range[1],
      ]);
    };

    const isOwnLine = (comment) => {
      const line = sourceCode.lines[comment.loc.start.line - 1] ?? '';
      return line.slice(0, comment.loc.start.column).trim() === '';
    };

    const isInFunctionBody = (comment) =>
      bodyRanges.some(
        ([start, end]) => comment.range[0] >= start && comment.range[1] <= end,
      );

    return {
      ArrowFunctionExpression: recordBody,
      FunctionDeclaration: recordBody,
      FunctionExpression: recordBody,

      'Program:exit'() {
        const comments = sourceCode
          .getAllComments()
          .filter(
            (comment) =>
              comment.type === 'Line' &&
              isOwnLine(comment) &&
              !isDirective(comment),
          );

        let index = 0;
        while (index < comments.length) {
          let last = index;
          while (
            last + 1 < comments.length &&
            comments[last + 1].loc.start.line ===
              comments[last].loc.start.line + 1
          ) {
            last += 1;
          }
          // one report per run, on its first line
          if (last > index && isInFunctionBody(comments[index])) {
            context.report({
              loc: comments[index].loc,
              messageId: 'commentBlockInBody',
            });
          }
          index = last + 1;
        }
      },
    };
  },
};

export default rule;
