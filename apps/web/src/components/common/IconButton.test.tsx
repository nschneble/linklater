import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IconButton from './IconButton';

describe('IconButton', () => {
  it('renders its children', () => {
    render(<IconButton>Click me</IconButton>);
    expect(
      screen.getByRole('button', { name: 'Click me' }),
    ).toBeInTheDocument();
  });

  it('defaults to type="button" so it never submits a form accidentally', () => {
    render(<IconButton>Save</IconButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<IconButton onClick={onClick}>Go</IconButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when the disabled prop is set', () => {
    render(<IconButton disabled>Locked</IconButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  describe('hidden prop', () => {
    it('disables the button when hidden is true so it is not interactive', () => {
      render(<IconButton hidden>Hidden</IconButton>);
      expect(screen.getByRole('button', { name: 'Hidden' })).toBeDisabled();
    });

    it('sets tabIndex to -1 when hidden so it is not keyboard reachable', () => {
      const { container } = render(<IconButton hidden>Skip me</IconButton>);
      const button = container.querySelector('button');
      expect(button).toHaveAttribute('tabindex', '-1');
    });

    it('applies opacity-0 class when hidden', () => {
      const { container } = render(<IconButton hidden>Gone</IconButton>);
      expect(container.querySelector('button')).toHaveClass('opacity-0');
    });

    it('does not set aria-hidden when hidden is false', () => {
      render(<IconButton hidden={false}>Visible</IconButton>);
      expect(
        screen.getByRole('button', { name: 'Visible' }),
      ).toBeInTheDocument();
    });
  });

  describe('variant', () => {
    it('renders without error for each supported variant', () => {
      const variants = [
        'default',
        'danger',
        'danger-filled',
        'ghost',
        'elevated',
      ] as const;

      for (const variant of variants) {
        const { unmount } = render(
          <IconButton variant={variant}>{variant}</IconButton>,
        );
        expect(
          screen.getByRole('button', { name: variant }),
        ).toBeInTheDocument();
        unmount();
      }
    });
  });

  it('merges className with internal classes', () => {
    const { container } = render(
      <IconButton className="my-custom-class">Custom</IconButton>,
    );
    expect(container.querySelector('button')).toHaveClass('my-custom-class');
  });

  it('passes through arbitrary native button attributes', () => {
    render(<IconButton aria-label="Open menu">Menu</IconButton>);
    expect(
      screen.getByRole('button', { name: 'Open menu' }),
    ).toBeInTheDocument();
  });
});
