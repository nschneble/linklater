import type { Element, Root, RootContent } from 'hast';

/**
 * Promotes the first cell of every table body row to `<th scope="row">`.
 *
 * GFM has no row-header syntax and the policy renderer deliberately skips
 * rehype-raw, so the markdown itself cannot express this. Doing it in the
 * `td` component mapping is equally impossible: react-markdown hands a
 * component only its own hast node, never its index or parent.
 *
 * It matters here because the GDPR table repeats itself down its last
 * column: five of its seven rows share a legal-basis value with another row.
 * Screen readers announce only the header axis that changed, so moving down
 * that column currently reads the same basis three times over with nothing
 * to say which purpose each belongs to.
 *
 * NOTE: the shared shell applies this to EVERY legal document, while the
 * table styling is opt-in per page via `makePolicyMarkdownComponents`. Terms
 * has no table today, so this is inert there; a table added to Terms would
 * get promoted row headers with no matching `th` mapping to style them.
 */
export function rehypeRowHeaders() {
  return (tree: Root) => {
    promoteRowHeaders(tree);
  };
}

function promoteRowHeaders(node: Root | RootContent) {
  if (!('children' in node)) {
    return;
  }

  if (node.type === 'element' && node.tagName === 'tbody') {
    for (const child of node.children) {
      if (child.type === 'element' && child.tagName === 'tr') {
        promoteFirstCell(child);
      }
    }
  }

  for (const child of node.children) {
    promoteRowHeaders(child);
  }
}

/**
 * `mdast-util-to-hast` wraps row children loosely, so `children[0]` is a
 * newline text node rather than a cell. Reaching for the first ELEMENT is
 * what makes this land at all.
 */
function promoteFirstCell(row: Element) {
  const firstCell = row.children.find(
    (child): child is Element => child.type === 'element',
  );
  if (!firstCell || firstCell.tagName !== 'td') {
    return;
  }

  firstCell.tagName = 'th';
  // a boolean here serializes to an invalid scope the UA has to guess
  firstCell.properties = { ...firstCell.properties, scope: 'row' };
}
