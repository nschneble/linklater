import type { Element, Root, RootContent } from 'hast';

const BREAK_TAG_PATTERN = /^<br\s*\/?>$/i;

/**
 * The policy renderer deliberately skips rehype-raw, so raw HTML in the
 * Markdown stays inert text. That posture breaks the one raw tag the policy
 * relies on: the `<br/>` separators inside the GDPR table cells. This plugin
 * swaps exactly those raw nodes for real <br> elements and leaves every other
 * raw HTML node untouched.
 */
export function rehypeBreakTags() {
  return (tree: Root) => {
    replaceBreakTags(tree);
  };
}

function replaceBreakTags(node: Root | RootContent) {
  if (!('children' in node)) {
    return;
  }

  node.children = node.children.map((child): RootContent => {
    if (child.type === 'raw' && BREAK_TAG_PATTERN.test(child.value.trim())) {
      return breakElement();
    }
    return child;
  });

  for (const child of node.children) {
    replaceBreakTags(child);
  }
}

function breakElement(): Element {
  return { type: 'element', tagName: 'br', properties: {}, children: [] };
}
