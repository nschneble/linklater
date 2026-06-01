import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import FormInput from './FormInput';

describe('FormInput', () => {
  describe('ref forwarding', () => {
    it('attaches ref.current to the underlying <input> element', () => {
      const reference = createRef<HTMLInputElement>();
      render(<FormInput ref={reference} />);
      expect(reference.current).toBeInstanceOf(HTMLInputElement);
    });

    it('moves focus to the input when ref.current.focus() is called', () => {
      const reference = createRef<HTMLInputElement>();
      render(<FormInput ref={reference} />);
      reference.current!.focus();
      expect(reference.current).toHaveFocus();
    });
  });

  describe('native attribute passthrough', () => {
    it('passes type to the underlying input', () => {
      render(<FormInput type="email" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');
    });

    it('passes id to the underlying input', () => {
      render(<FormInput id="my-field" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('id', 'my-field');
    });

    it('passes name to the underlying input', () => {
      render(<FormInput name="username" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('name', 'username');
    });

    it('passes required to the underlying input', () => {
      render(<FormInput required />);
      expect(screen.getByRole('textbox')).toBeRequired();
    });

    it('passes aria-describedby to the underlying input', () => {
      render(<FormInput aria-describedby="hint-text" />);
      expect(screen.getByRole('textbox')).toHaveAttribute(
        'aria-describedby',
        'hint-text',
      );
    });

    it('passes aria-invalid to the underlying input', () => {
      render(<FormInput aria-invalid={true} />);
      expect(screen.getByRole('textbox')).toHaveAttribute(
        'aria-invalid',
        'true',
      );
    });

    it('passes aria-label to the underlying input', () => {
      render(<FormInput aria-label="Email address" />);
      expect(
        screen.getByRole('textbox', { name: 'Email address' }),
      ).toBeInTheDocument();
    });

    it('passes autoComplete to the underlying input', () => {
      render(<FormInput autoComplete="email" />);
      expect(screen.getByRole('textbox')).toHaveAttribute(
        'autocomplete',
        'email',
      );
    });

    it('passes placeholder to the underlying input', () => {
      render(<FormInput placeholder="Enter your email" />);
      expect(screen.getByRole('textbox')).toHaveAttribute(
        'placeholder',
        'Enter your email',
      );
    });

    it('passes disabled to the underlying input', () => {
      render(<FormInput disabled />);
      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('passes readOnly to the underlying input', () => {
      render(<FormInput readOnly />);
      expect(screen.getByRole('textbox')).toHaveAttribute('readonly');
    });
  });

  describe('id stability', () => {
    it('preserves the id exactly so htmlFor wiring works', () => {
      const { container } = render(<FormInput id="email-input" />);
      const input = container.querySelector('input');
      expect(input).toHaveAttribute('id', 'email-input');
    });

    it('is discoverable via getByLabelText when wrapped in a label', () => {
      render(
        <label>
          Email
          <FormInput />
        </label>,
      );
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });
  });

  describe('className merging', () => {
    it('base focus ring classes survive a custom className', () => {
      const { container } = render(<FormInput className="extra-class" />);
      const input = container.querySelector('input');
      expect(input).toHaveClass('extra-class');
      expect(input).toHaveClass('focus:ring-2');
      expect(input).toHaveClass('focus:ring-[var(--accent)]');
      expect(input).toHaveClass('focus:outline-none');
    });

    it('does not replace base classes when no className is provided', () => {
      const { container } = render(<FormInput />);
      const input = container.querySelector('input');
      expect(input).toHaveClass('focus:ring-2');
      expect(input).toHaveClass('focus:ring-[var(--accent)]');
      expect(input).toHaveClass('focus:outline-none');
    });
  });

  describe('onChange behavior', () => {
    it('fires onChange for every typed character via userEvent.type', async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();
      render(<FormInput onChange={handleChange} />);
      await user.type(screen.getByRole('textbox'), 'hello');
      expect(handleChange).toHaveBeenCalledTimes(5);
    });
  });

  describe('role and discoverability', () => {
    it('is found by getByRole("textbox") for type="text"', () => {
      render(<FormInput type="text" />);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('is found by getByLabelText when a label is associated via htmlFor', () => {
      render(
        <>
          <label htmlFor="target-input">Username</label>
          <FormInput id="target-input" />
        </>,
      );
      expect(screen.getByLabelText('Username')).toBeInTheDocument();
    });
  });
});
