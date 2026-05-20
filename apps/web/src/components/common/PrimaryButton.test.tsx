import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PrimaryButton from './PrimaryButton';

describe('PrimaryButton', () => {
  it('renders its children', () => {
    render(<PrimaryButton>Save link</PrimaryButton>);
    expect(
      screen.getByRole('button', { name: 'Save link' }),
    ).toBeInTheDocument();
  });

  it('defaults to type="submit" so it works inside a form without extra wiring', () => {
    render(<PrimaryButton>Submit</PrimaryButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('respects an explicit type="button" override', () => {
    render(<PrimaryButton type="button">Action</PrimaryButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<PrimaryButton onClick={onClick}>Go</PrimaryButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when the disabled prop is set', () => {
    render(<PrimaryButton disabled>Locked</PrimaryButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  describe('hidden prop', () => {
    it('disables the button when hidden is true so it is not interactive', () => {
      const { container } = render(
        <PrimaryButton hidden>Hidden</PrimaryButton>,
      );
      expect(container.querySelector('button')).toBeDisabled();
    });

    it('sets aria-hidden="true" when hidden so screen readers skip it in browse mode', () => {
      const { container } = render(
        <PrimaryButton hidden>Hidden</PrimaryButton>,
      );
      expect(container.querySelector('button')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    });

    it('does not set aria-hidden when visible', () => {
      render(<PrimaryButton hidden={false}>Visible</PrimaryButton>);
      expect(
        screen.getByRole('button', { name: 'Visible' }),
      ).not.toHaveAttribute('aria-hidden');
    });

    it('sets tabIndex to -1 when hidden so it is not keyboard reachable', () => {
      const { container } = render(
        <PrimaryButton hidden>Skip me</PrimaryButton>,
      );
      const button = container.querySelector('button');
      expect(button).toHaveAttribute('tabindex', '-1');
    });

    it('applies opacity-0 class when hidden', () => {
      const { container } = render(<PrimaryButton hidden>Gone</PrimaryButton>);
      expect(container.querySelector('button')).toHaveClass('opacity-0');
    });

    it('is visible and keyboard reachable when hidden is false', () => {
      render(<PrimaryButton hidden={false}>Visible</PrimaryButton>);
      const button = screen.getByRole('button', { name: 'Visible' });
      expect(button).toBeInTheDocument();
      expect(button).not.toHaveAttribute('tabindex', '-1');
    });
  });

  it('merges className with internal classes', () => {
    const { container } = render(
      <PrimaryButton className="extra-padding">Custom</PrimaryButton>,
    );
    expect(container.querySelector('button')).toHaveClass('extra-padding');
  });

  it('forwards aria-* attributes to the underlying button', () => {
    render(
      <PrimaryButton type="button" aria-expanded={true} aria-controls="my-form">
        Toggle
      </PrimaryButton>,
    );
    const button = screen.getByRole('button', { name: 'Toggle' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(button).toHaveAttribute('aria-controls', 'my-form');
  });
});
