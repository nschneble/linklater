import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LinkButton from './LinkButton';

describe('LinkButton', () => {
  describe('element type and default attributes', () => {
    it('renders as a <button> element', () => {
      render(<LinkButton onClick={vi.fn()}>Click me</LinkButton>);
      expect(screen.getByRole('button').tagName).toBe('BUTTON');
    });

    it('has type="button" so it never accidentally submits a form', () => {
      render(<LinkButton onClick={vi.fn()}>Click me</LinkButton>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });

    it('is not a link — queryByRole("link") returns null', () => {
      render(<LinkButton onClick={vi.fn()}>Not a link</LinkButton>);
      expect(screen.queryByRole('link')).toBeNull();
    });
  });

  describe('keyboard reachability', () => {
    it('receives focus via the Tab sequence', async () => {
      const user = userEvent.setup();
      render(<LinkButton onClick={vi.fn()}>Focus me</LinkButton>);
      await user.tab();
      expect(screen.getByRole('button')).toHaveFocus();
    });

    it('invokes onClick when Enter is pressed on the focused button', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<LinkButton onClick={handleClick}>Press Enter</LinkButton>);
      await user.tab();
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledOnce();
    });

    it('invokes onClick when Space is pressed on the focused button', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<LinkButton onClick={handleClick}>Press Space</LinkButton>);
      await user.tab();
      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledOnce();
    });
  });

  describe('disabled state', () => {
    it('does not fire onClick when disabled and clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(
        <LinkButton onClick={handleClick} disabled>
          Disabled
        </LinkButton>,
      );
      await user.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('is removed from the tab sequence when disabled', () => {
      render(
        <LinkButton onClick={vi.fn()} disabled>
          Disabled
        </LinkButton>,
      );
      expect(screen.getByRole('button', { hidden: true })).toBeDisabled();
    });
  });

  describe('accessible name', () => {
    it('takes its accessible name from text children', () => {
      render(<LinkButton onClick={vi.fn()}>Back to login</LinkButton>);
      expect(
        screen.getByRole('button', { name: 'Back to login' }),
      ).toBeInTheDocument();
    });

    it('uses aria-label when provided alongside an icon child', () => {
      render(
        <LinkButton onClick={vi.fn()} aria-label="Close dialog">
          <i aria-hidden="true" className="fa-times" />
        </LinkButton>,
      );
      expect(
        screen.getByRole('button', { name: 'Close dialog' }),
      ).toBeInTheDocument();
    });
  });

  describe('ARIA passthrough', () => {
    it('forwards aria-describedby to the button element', () => {
      render(
        <LinkButton onClick={vi.fn()} aria-describedby="hint-123">
          Action
        </LinkButton>,
      );
      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-describedby',
        'hint-123',
      );
    });

    it('forwards aria-pressed to the button element', () => {
      render(
        <LinkButton onClick={vi.fn()} aria-pressed={true}>
          Toggle
        </LinkButton>,
      );
      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('forwards aria-expanded to the button element', () => {
      render(
        <LinkButton onClick={vi.fn()} aria-expanded={false}>
          Expand
        </LinkButton>,
      );
      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });
  });

  describe('className merging', () => {
    it('preserves base underline class when a custom className is added', () => {
      render(
        <LinkButton onClick={vi.fn()} className="my-extra">
          Styled
        </LinkButton>,
      );
      const button = screen.getByRole('button');
      expect(button).toHaveClass('my-extra');
      expect(button).toHaveClass('underline');
    });

    it('preserves disabled:opacity-50 utility with a custom className', () => {
      const { container } = render(
        <LinkButton onClick={vi.fn()} className="another-class">
          Test
        </LinkButton>,
      );
      expect(container.querySelector('button')).toHaveClass(
        'disabled:opacity-50',
      );
    });
  });
});
