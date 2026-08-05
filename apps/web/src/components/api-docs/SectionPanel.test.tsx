import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SectionPanel from './SectionPanel';

const baseProps = {
  id: 'endpoint-panel-request',
  labelledById: 'endpoint-tab-request',
  active: true,
};

describe('SectionPanel', () => {
  it('renders a single tabpanel wired to its id and controlling tab', () => {
    const { container } = render(
      <SectionPanel {...baseProps}>
        <span>content</span>
      </SectionPanel>,
    );

    // exactly one root node; a wrapper breaks the sibling-of-tablist nav
    expect(container.childNodes).toHaveLength(1);

    const panel = screen.getByRole('tabpanel');
    expect(panel.tagName).toBe('DIV');
    expect(panel).toHaveAttribute('id', 'endpoint-panel-request');
    expect(panel).toHaveAttribute('aria-labelledby', 'endpoint-tab-request');
    expect(panel).toHaveTextContent('content');
  });

  it('toggles the [hidden] boolean attribute off `active` while staying mounted', () => {
    const { container, rerender } = render(
      <SectionPanel {...baseProps} active={true}>
        <span>content</span>
      </SectionPanel>,
    );
    const panel = container.querySelector('#endpoint-panel-request')!;
    expect(panel).not.toHaveAttribute('hidden');

    rerender(
      <SectionPanel {...baseProps} active={false}>
        <span>content</span>
      </SectionPanel>,
    );
    // real HTML boolean attribute; children stay mounted underneath
    expect(panel).toHaveAttribute('hidden');
    expect(panel).toHaveTextContent('content');
  });

  it('becomes the keyboard focus stop when it has no focusable content', () => {
    render(
      <SectionPanel {...baseProps} hasFocusableContent={false}>
        <span>content</span>
      </SectionPanel>,
    );
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(panel).toHaveClass('focus-visible:ring-2');
  });

  it('defaults to a focus stop when hasFocusableContent is omitted', () => {
    render(
      <SectionPanel {...baseProps}>
        <span>content</span>
      </SectionPanel>,
    );
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(panel).toHaveClass('focus-visible:ring-2');
  });

  it('drops its own tab stop and ring when it owns a focusable descendant', () => {
    render(
      <SectionPanel {...baseProps} hasFocusableContent={true}>
        <button type="button">focusable</button>
      </SectionPanel>,
    );
    const panel = screen.getByRole('tabpanel');
    expect(panel).not.toHaveAttribute('tabindex');
    expect(panel.className).not.toContain('focus-visible:ring-2');
  });

  it('merges a passed className after the (conditional) focus ring', () => {
    render(
      <SectionPanel {...baseProps} hasFocusableContent={false} className="mt-2">
        <span>content</span>
      </SectionPanel>,
    );
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveClass('mt-2');
    expect(panel).toHaveClass('focus-visible:ring-2');
  });
});
