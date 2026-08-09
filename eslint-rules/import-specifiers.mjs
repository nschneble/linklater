/**
 * The specifier half of `import-identifier-order`: which order the names
 * inside one import's braces take.
 *
 * Split out alongside the statement half so the rule file states what the
 * rule is and each half states how it works. This half needs none of the
 * group, block, or run machinery the statement half is built on, and the
 * two share only the comparison, so neither can drift from the other.
 *
 * A renamed specifier reads under the imported name rather than the local
 * alias, matching how a whole declaration reads: the name written first.
 *
 * The fix rewrites each specifier's own text in place, leaving every comma,
 * line break, and trailing comma exactly where the author put it, so an
 * import that was formatted across several lines stays that way. Rewriting
 * only the specifier ranges also carries an inline type modifier along with
 * its name, since the modifier is part of the specifier's own text.
 */

import { compareIdentifiers } from './compare-identifiers.mjs';

export function specifierIdentifier(specifier) {
  return specifier.imported?.name ?? specifier.local.name;
}

// value specifiers sort ahead of type specifiers, matching the statement
// partition the sibling rule enforces
function specifierRank(specifier) {
  return specifier.importKind === 'type' ? 1 : 0;
}

function sortSpecifiers(specifiers) {
  return specifiers
    .map((specifier, index) => ({ specifier, index }))
    .sort((first, second) => {
      const byKind =
        specifierRank(first.specifier) - specifierRank(second.specifier);
      if (byKind !== 0) {
        return byKind;
      }
      const order = compareIdentifiers(
        specifierIdentifier(first.specifier),
        specifierIdentifier(second.specifier),
      );
      // stable: equal identifiers keep their authored order
      return order === 0 ? first.index - second.index : order;
    });
}

/**
 * Reports the named specifiers of one import declaration when they are out
 * of order, and offers a fix unless a comment sits among them.
 *
 * A comment inside the braces belongs to a position, not to a name. Because
 * the fix swaps specifier text and leaves everything between untouched, such
 * a comment would stay put while the name it describes moved out from under
 * it. Reporting without a fix keeps the developer informed and keeps the
 * autofix from quietly attaching a note to the wrong import, which is the
 * worse of the two outcomes and the harder one to notice in a diff.
 *
 * Fixability is decided across the whole declaration rather than the span
 * the specifiers occupy. A leading comment sits above the first specifier
 * and so falls outside that span, yet it is exactly the one a reorder would
 * strand, which is how the narrower test failed its own regression case.
 */
export function checkNamedSpecifierOrder(context, node) {
  const sourceCode = context.sourceCode;
  const named = node.specifiers.filter(
    (specifier) => specifier.type === 'ImportSpecifier',
  );
  if (named.length < 2) {
    return;
  }

  const sorted = sortSpecifiers(named);
  const firstWrong = sorted.findIndex(
    (entry, position) => entry.index !== position,
  );
  if (firstWrong === -1) {
    return;
  }

  const isFixable = sourceCode.getCommentsInside(node).length === 0;

  context.report({
    node: sorted[firstWrong].specifier,
    messageId: 'unsortedSpecifiers',
    data: {
      identifier: specifierIdentifier(sorted[firstWrong].specifier),
      predecessor: specifierIdentifier(named[firstWrong]),
    },
    fix: isFixable
      ? (fixer) =>
          sorted.map((entry, position) =>
            fixer.replaceTextRange(
              named[position].range,
              sourceCode.getText(entry.specifier),
            ),
          )
      : undefined,
  });
}
