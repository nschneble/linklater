/**
 * Guards the no-rehype-raw posture: only `<br/>`-shaped raw nodes become real
 * elements; all other raw HTML must stay inert text. react-markdown's internal
 * ordering (user rehype plugins before its raw-node stringification) is
 * undocumented, so this also tripwires react-markdown upgrades.
 */

import { describe, expect, it } from 'vitest';
import ReactMarkdown from 'react-markdown';
import { rehypeBreakTags } from './rehypeBreakTags';
import remarkGfm from 'remark-gfm';
import { render } from '@testing-library/react';

function renderMarkdown(markdown: string) {
  return render(
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeBreakTags]}
    >
      {markdown}
    </ReactMarkdown>,
  );
}

describe('rehypeBreakTags', () => {
  it.each(['<br/>', '<br>', '<br />', '<BR/>'])(
    'converts %s into a real line break element',
    (breakTag) => {
      const { container } = renderMarkdown(`first${breakTag}second`);

      expect(container.querySelectorAll('br')).toHaveLength(1);
      expect(container.textContent).not.toContain(breakTag);
    },
  );

  it('converts break tags inside GFM table cells', () => {
    const { container } = renderMarkdown(
      '| Basis |\n| --- |\n| Contract<br/>Art. 6(1)(b) |',
    );

    expect(container.querySelectorAll('td br')).toHaveLength(1);
    expect(container.querySelector('td')?.textContent).toBe(
      'ContractArt. 6(1)(b)',
    );
  });

  it('leaves other raw HTML inert as text', () => {
    const { container } = renderMarkdown(
      'stay safe <script>window.alert(1)</script><em>markup</em>',
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('em')).toBeNull();
    expect(container.textContent).toContain('<em>markup</em>');
  });
});
