/**
 * Guards the row-header promotion. Every case renders through the real
 * remark-gfm to hast pipeline rather than a hand-built tree, because the
 * trap this plugin has to survive is a detail of that pipeline:
 * `mdast-util-to-hast` calls `state.wrap(cells, true)`, which interleaves
 * `'\n'` text nodes and puts one FIRST. A plugin that reaches for
 * `row.children[0]` therefore finds a newline, promotes nothing, throws
 * nothing, and looks like it worked. Only a real render catches that.
 */

import { describe, expect, it } from 'vitest';
import ReactMarkdown from 'react-markdown';
import { rehypeRowHeaders } from './rehypeRowHeaders';
import remarkGfm from 'remark-gfm';
import { render } from '@testing-library/react';

const TABLE_MARKDOWN = [
  '| Purpose | Data used | Legal basis |',
  '| --- | --- | --- |',
  '| Running your account | Email | Contract |',
  '| Keeping you signed in | Cookies | Contract |',
].join('\n');

function renderMarkdown(markdown: string) {
  return render(
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRowHeaders]}
    >
      {markdown}
    </ReactMarkdown>,
  );
}

describe('rehypeRowHeaders', () => {
  it('promotes each body row first cell to a scoped row header', () => {
    const { container } = renderMarkdown(TABLE_MARKDOWN);

    const rowHeaders = container.querySelectorAll('tbody th[scope="row"]');
    expect([...rowHeaders].map((cell) => cell.textContent)).toEqual([
      'Running your account',
      'Keeping you signed in',
    ]);
  });

  it('leaves the header row alone', () => {
    const { container } = renderMarkdown(TABLE_MARKDOWN);

    // thead cells are already th; promoting them would claim each prose
    // sentence heads the whole column beneath it
    expect(container.querySelectorAll('thead th')).toHaveLength(3);
    expect(container.querySelectorAll('thead th[scope="row"]')).toHaveLength(0);
  });

  it('leaves every cell after the first as a data cell', () => {
    const { container } = renderMarkdown(TABLE_MARKDOWN);

    expect(
      [...container.querySelectorAll('tbody td')].map(
        (cell) => cell.textContent,
      ),
    ).toEqual(['Email', 'Contract', 'Cookies', 'Contract']);
  });

  it('writes scope as the literal string, not a boolean', () => {
    const { container } = renderMarkdown(TABLE_MARKDOWN);

    // a boolean would stringify to scope="true", an invalid enumerated value
    // that silently falls back to the UA's own scoping
    const firstRowHeader = container.querySelector('tbody th');
    expect(firstRowHeader?.getAttribute('scope')).toBe('row');
  });

  it('leaves a table with no body rows untouched', () => {
    const { container } = renderMarkdown('| Only |\n| --- |');

    expect(container.querySelectorAll('th[scope="row"]')).toHaveLength(0);
    expect(container.querySelectorAll('thead th')).toHaveLength(1);
  });

  it('leaves prose without a table untouched', () => {
    const { container } = renderMarkdown('Just a paragraph.');

    expect(container.querySelectorAll('th')).toHaveLength(0);
    expect(container.textContent).toBe('Just a paragraph.');
  });
});
