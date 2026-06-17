import MethodBadge from './MethodBadge';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('MethodBadge', () => {
  it('renders the method as real, uppercased text', () => {
    const { container } = render(<MethodBadge method="get" />);
    expect(container).toHaveTextContent('GET');
  });

  it('marks the badge aria-hidden so the method is not double-announced (B1)', () => {
    const { container } = render(<MethodBadge method="post" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies the brand-locked palette per method (B2)', () => {
    const { container } = render(<MethodBadge method="get" />);
    const badge = container.querySelector('span');
    // Inline style colors are brand constants, not theme tokens.
    expect(badge).toHaveStyle({ color: '#a7f3d0' });
  });

  it('falls back to a neutral palette for an unknown method', () => {
    const { container } = render(<MethodBadge method="trace" />);
    const badge = container.querySelector('span');
    expect(badge).toHaveTextContent('TRACE');
    expect(badge).toHaveStyle({ color: '#eeeede' });
  });
});
