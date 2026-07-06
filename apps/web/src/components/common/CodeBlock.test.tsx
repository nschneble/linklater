import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CodeBlock from './CodeBlock';

const props = {
  label: 'Example request body',
  code: '{\n  "url": "https://example.com"\n}',
  labelId: 'get-links-request-example',
};

describe('CodeBlock', () => {
  it('renders the visible label as a plain paragraph (not a heading) carrying the given id', () => {
    render(<CodeBlock {...props} />);
    const label = screen.getByText('Example request body');
    expect(label.tagName).toBe('P');
    expect(label).toHaveAttribute('id', 'get-links-request-example');
    // The label must NOT be a heading – it stays out of H-key navigation.
    expect(
      screen.queryByRole('heading', { name: 'Example request body' }),
    ).not.toBeInTheDocument();
  });

  it('exposes the scroll container as a focusable, labelled group', () => {
    render(<CodeBlock {...props} />);
    const group = screen.getByRole('group', { name: 'Example request body' });
    expect(group.tagName).toBe('PRE');
    // The <pre> is the scroll container, so a keyboard user can focus it.
    expect(group).toHaveAttribute('tabindex', '0');
    // Named from the visible label's id, never a hidden aria-label.
    expect(group).toHaveAttribute(
      'aria-labelledby',
      'get-links-request-example',
    );
    expect(group).not.toHaveAttribute('aria-label');
  });

  it('renders the code verbatim inside a <code> element', () => {
    const { container } = render(<CodeBlock {...props} />);
    const code = container.querySelector('pre > code');
    expect(code).not.toBeNull();
    expect(code).toHaveTextContent('"url": "https://example.com"');
  });

  it('paints the mount input chrome and the shared focus ring on the <pre>', () => {
    render(<CodeBlock {...props} />);
    const group = screen.getByRole('group', { name: 'Example request body' });
    expect(group).toHaveClass('bg-[var(--mount-input-bg)]');
    expect(group).toHaveClass('border-[var(--mount-border)]');
    expect(group).toHaveClass('text-[var(--mount-text)]');
    expect(group).toHaveClass('select-text');
    // Shared focus ring so the focus stop is visible under keyboard nav.
    expect(group).toHaveClass('focus-visible:ring-2');
  });
});
