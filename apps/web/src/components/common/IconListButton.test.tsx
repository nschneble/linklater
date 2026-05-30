import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import IconListButton from './IconListButton';

describe('IconListButton', () => {
  it('renders its children inside a button element', () => {
    render(<IconListButton>Account</IconListButton>);
    expect(screen.getByRole('button', { name: 'Account' })).toBeInTheDocument();
  });

  it('defaults to type="button" so it never submits a form accidentally', () => {
    render(<IconListButton>Account</IconListButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<IconListButton onClick={onClick}>Go</IconListButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled when the disabled prop is set', () => {
    render(<IconListButton disabled>Locked</IconListButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('forwards aria-current so the active row can be styled via Tailwind variants', () => {
    render(<IconListButton aria-current="page">Account</IconListButton>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-current', 'page');
  });

  it('renders an icon when icon is provided', () => {
    const { container } = render(
      <IconListButton icon="fa-user">Account</IconListButton>,
    );
    const icon = container.querySelector('i');
    expect(icon).not.toBeNull();
    expect(icon?.className).toMatch(/fa-user/);
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  describe('hidden prop', () => {
    it('disables the button when hidden is true so it is not interactive', () => {
      const { container } = render(
        <IconListButton hidden>Hidden</IconListButton>,
      );
      expect(container.querySelector('button')).toBeDisabled();
    });

    it('sets aria-hidden="true" when hidden so screen readers skip it', () => {
      const { container } = render(
        <IconListButton hidden>Hidden</IconListButton>,
      );
      expect(container.querySelector('button')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    });

    it('does not set aria-hidden when visible', () => {
      render(<IconListButton hidden={false}>Visible</IconListButton>);
      expect(
        screen.getByRole('button', { name: 'Visible' }),
      ).not.toHaveAttribute('aria-hidden');
    });

    it('sets tabIndex to -1 when hidden so it is not keyboard reachable', () => {
      const { container } = render(
        <IconListButton hidden>Skip me</IconListButton>,
      );
      expect(container.querySelector('button')).toHaveAttribute(
        'tabindex',
        '-1',
      );
    });
  });

  it('merges className with internal classes', () => {
    const { container } = render(
      <IconListButton className="my-custom-class">Custom</IconListButton>,
    );
    expect(container.querySelector('button')).toHaveClass('my-custom-class');
  });

  it('passes through arbitrary native button attributes', () => {
    render(<IconListButton aria-label="Open Account">Account</IconListButton>);
    expect(
      screen.getByRole('button', { name: 'Open Account' }),
    ).toBeInTheDocument();
  });
});
