import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TabButton from './TabButton';

describe('TabButton', () => {
  it('renders children', () => {
    render(
      <TabButton isActive={false} onClick={vi.fn()}>
        Unread
      </TabButton>,
    );
    expect(screen.getByRole('tab')).toHaveTextContent('Unread');
  });

  it('exposes a single accessible name despite the ghost label', () => {
    render(
      <TabButton isActive={false} onClick={vi.fn()}>
        Unread
      </TabButton>,
    );
    expect(screen.getByRole('tab', { name: 'Unread' })).toBeInTheDocument();
  });

  it('has role="tab"', () => {
    render(
      <TabButton isActive={false} onClick={vi.fn()}>
        Unread
      </TabButton>,
    );
    expect(screen.getByRole('tab')).toBeInTheDocument();
  });

  it('has aria-selected="true" when isActive is true', () => {
    render(
      <TabButton isActive={true} onClick={vi.fn()}>
        Unread
      </TabButton>,
    );
    expect(screen.getByRole('tab')).toHaveAttribute('aria-selected', 'true');
  });

  it('has aria-selected="false" when isActive is false', () => {
    render(
      <TabButton isActive={false} onClick={vi.fn()}>
        Unread
      </TabButton>,
    );
    expect(screen.getByRole('tab')).toHaveAttribute('aria-selected', 'false');
  });

  it('applies font-extrabold when active', () => {
    render(
      <TabButton isActive={true} onClick={vi.fn()}>
        Active
      </TabButton>,
    );
    expect(screen.getByRole('tab')).toHaveClass('font-extrabold');
  });

  it('applies font-semibold when inactive', () => {
    render(
      <TabButton isActive={false} onClick={vi.fn()}>
        Inactive
      </TabButton>,
    );
    expect(screen.getByRole('tab')).toHaveClass('font-semibold');
  });

  it('renders the fa-circle-dot icon when active', () => {
    const { container } = render(
      <TabButton isActive={true} onClick={vi.fn()}>
        Active
      </TabButton>,
    );
    const icons = container.querySelectorAll('i.fa-circle-dot');
    expect(icons.length).toBe(2);
    icons.forEach((icon) => {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  it('does not render the fa-circle-dot icon in the visible label when inactive', () => {
    const { container } = render(
      <TabButton isActive={false} onClick={vi.fn()}>
        Inactive
      </TabButton>,
    );
    const icons = container.querySelectorAll('i.fa-circle-dot');
    expect(icons.length).toBe(1);
    const ghostSpan = container.querySelector('span[aria-hidden="true"]');
    expect(ghostSpan).toContainElement(icons[0] as HTMLElement);
  });

  it('is not keyboard-focusable when inactive (tabIndex -1)', () => {
    render(
      <TabButton isActive={false} onClick={vi.fn()}>
        Unread
      </TabButton>,
    );
    expect(screen.getByRole('tab')).toHaveAttribute('tabindex', '-1');
  });

  it('is keyboard-focusable when active (tabIndex 0)', () => {
    render(
      <TabButton isActive={true} onClick={vi.fn()}>
        Read
      </TabButton>,
    );
    expect(screen.getByRole('tab')).toHaveAttribute('tabindex', '0');
  });
});
