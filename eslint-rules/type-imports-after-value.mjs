/**
 * Local ESLint rule: require declaration-level `import type { ... }` statements
 * to appear after value `import` statements within the same contiguous import
 * block.
 *
 * Encodes the project convention (see `.claude/CLAUDE.md`, React Patterns):
 * "Put `import {}` before `import type {}`."
 *
 * The autofix performs a stable partition: it swaps an offending `import type`
 * declaration with the value import that follows it, preserving the original
 * relative order of value imports and of type imports. Because type-only
 * declarations are elided at compile time, moving them relative to value
 * imports never changes runtime behavior.
 */

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'layout',
    docs: {
      description:
        'Require declaration-level `import type` statements to appear after value imports within the same import block.',
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

    return {
      Program(program) {
        let run = [];

        const checkRun = () => {
          for (let index = 0; index < run.length - 1; index++) {
            const current = run[index];
            const next = run[index + 1];

            if (current.importKind === 'type' && next.importKind === 'value') {
              context.report({
                node: current,
                messageId: 'typeBeforeValue',
                fix(fixer) {
                  const currentText = sourceCode.getText(current);
                  const nextText = sourceCode.getText(next);

                  return [
                    fixer.replaceText(current, nextText),
                    fixer.replaceText(next, currentText),
                  ];
                },
              });
            }
          }

          run = [];
        };

        for (const node of program.body) {
          if (node.type === 'ImportDeclaration') {
            run.push(node);
          } else {
            checkRun();
          }
        }

        checkRun();
      },
    };
  },
};

export default rule;
