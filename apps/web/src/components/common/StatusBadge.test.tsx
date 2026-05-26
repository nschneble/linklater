import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import StatusBadge from './StatusBadge';
import { ThemeProvider } from '../../theme/ThemeContext';
import { MODE_STORAGE_KEY, THEME_STORAGE_KEY } from '../../theme/storage';

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

  describe('on the Nouvelle Vague (noir) theme', () => {
    beforeEach(() => {
      window.localStorage.setItem(THEME_STORAGE_KEY, 'nouvelle-vague');
    });

    afterEach(() => {
      window.localStorage.clear();
    });

    function renderInNoir(mode: 'light' | 'dark') {
      window.localStorage.setItem(MODE_STORAGE_KEY, mode);
      return render(
        <ThemeProvider>
          <StatusBadge variant="success">Verified</StatusBadge>
        </ThemeProvider>,
      );
    }

    it('renders the success badge with monochrome inverted classes in dark mode', () => {
      const { container } = renderInNoir('dark');
      const badge = container.querySelector('span');
      expect(badge).toHaveClass(
        'bg-[var(--accent)]',
        'border-[var(--accent)]',
        'text-[var(--accent-fg)]',
        'font-medium',
      );
      expect(badge?.className).not.toMatch(/emerald|teal|green/);
    });

    it('renders the success badge with monochrome inverted classes in light mode', () => {
      const { container } = renderInNoir('light');
      const badge = container.querySelector('span');
      expect(badge).toHaveClass(
        'bg-[var(--accent)]',
        'border-[var(--accent)]',
        'text-[var(--accent-fg)]',
        'font-medium',
      );
      expect(badge?.className).not.toMatch(/emerald|teal|green/);
    });

    it('still renders the checkmark icon so success meaning is conveyed by shape, not color', () => {
      const { container } = renderInNoir('dark');
      const icon = container.querySelector('i');
      expect(icon).toHaveClass('fa-circle-check');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('on non-noir themes', () => {
    afterEach(() => {
      window.localStorage.clear();
    });

    it('keeps the emerald colorful styling on the default theme', () => {
      window.localStorage.setItem(THEME_STORAGE_KEY, 'scanner-darkly');
      window.localStorage.setItem(MODE_STORAGE_KEY, 'dark');
      const { container } = render(
        <ThemeProvider>
          <StatusBadge variant="success">Verified</StatusBadge>
        </ThemeProvider>,
      );
      const badge = container.querySelector('span');
      expect(badge).toHaveClass(
        'bg-emerald-950/20',
        'border-emerald-800/40',
        'text-emerald-400',
      );
    });
  });
});
