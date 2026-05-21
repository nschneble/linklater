import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusBadge from './StatusBadge';

vi.mock('../../theme/ThemeContext', () => ({
  useTheme: () => ({ baseTheme: 'scanner-darkly' }),
}));

describe('StatusBadge', () => {
  describe('success variant', () => {
    it('renders children', () => {
      render(<StatusBadge variant="success">Verified</StatusBadge>);
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('renders the default success icon fa-circle-check', () => {
      const { container } = render(
        <StatusBadge variant="success">Verified</StatusBadge>,
      );
      const icon = container.querySelector('i');
      expect(icon).toHaveClass('fa-circle-check');
    });
  });

  describe('warning variant', () => {
    it('renders children', () => {
      render(<StatusBadge variant="warning">Unverified</StatusBadge>);
      expect(screen.getByText('Unverified')).toBeInTheDocument();
    });

    it('renders the default warning icon fa-triangle-exclamation', () => {
      const { container } = render(
        <StatusBadge variant="warning">Unverified</StatusBadge>,
      );
      const icon = container.querySelector('i');
      expect(icon).toHaveClass('fa-triangle-exclamation');
    });
  });

  describe('info variant', () => {
    it('renders children', () => {
      render(<StatusBadge variant="info">Recommended</StatusBadge>);
      expect(screen.getByText('Recommended')).toBeInTheDocument();
    });

    it('renders the default info icon fa-circle-info', () => {
      const { container } = render(
        <StatusBadge variant="info">Recommended</StatusBadge>,
      );
      const icon = container.querySelector('i');
      expect(icon).toHaveClass('fa-circle-info');
    });
  });

  it('renders a custom icon when the icon prop is provided', () => {
    const { container } = render(
      <StatusBadge variant="success" icon="fa-solid fa-star">
        Special
      </StatusBadge>,
    );
    const icon = container.querySelector('i');
    expect(icon).toHaveClass('fa-star');
    expect(icon).not.toHaveClass('fa-circle-check');
  });

  it('the icon has aria-hidden="true" so it is not announced by screen readers', () => {
    const { container } = render(
      <StatusBadge variant="success">Verified</StatusBadge>,
    );
    const icon = container.querySelector('i');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
