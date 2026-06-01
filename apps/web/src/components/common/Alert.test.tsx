import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Alert from './Alert';

describe('Alert', () => {
  describe('error variant', () => {
    it('renders the message', () => {
      render(<Alert variant="error">Something went wrong</Alert>);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('has role="alert" for immediate screen reader announcement', () => {
      render(<Alert variant="error">Oops</Alert>);
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders the default error icon fa-circle-exclamation', () => {
      const { container } = render(<Alert variant="error">Oops</Alert>);
      const icon = container.querySelector('i');
      expect(icon).toHaveClass('fa-circle-exclamation');
    });

    it('renders a custom icon when the icon prop is provided', () => {
      const { container } = render(
        <Alert variant="error" icon="fa-triangle-exclamation">
          Oops
        </Alert>,
      );
      const icon = container.querySelector('i');
      expect(icon).toHaveClass('fa-triangle-exclamation');
      expect(icon).not.toHaveClass('fa-circle-exclamation');
    });
  });

  describe('success variant', () => {
    it('renders the message', () => {
      render(<Alert variant="success">All good</Alert>);
      expect(screen.getByText('All good')).toBeInTheDocument();
    });

    it('has role="status" for polite screen reader announcement', () => {
      render(<Alert variant="success">Saved</Alert>);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders the default success icon fa-circle-check', () => {
      const { container } = render(<Alert variant="success">Saved</Alert>);
      const icon = container.querySelector('i');
      expect(icon).toHaveClass('fa-circle-check');
    });
  });

  it('sets the id attribute when provided', () => {
    render(
      <Alert variant="error" id="my-error">
        Error
      </Alert>,
    );
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'my-error');
  });

  it('applies additional className when provided', () => {
    render(
      <Alert variant="error" className="mt-4">
        Error
      </Alert>,
    );
    expect(screen.getByRole('alert')).toHaveClass('mt-4');
  });

  it('the icon has aria-hidden="true" so it is not announced by screen readers', () => {
    const { container } = render(<Alert variant="error">Oops</Alert>);
    const icon = container.querySelector('i');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  // Callers focus the alert programmatically via ref + tabIndex={-1} so screen
  // readers re-announce on error. Browsers do not match `:focus-visible` on
  // script-driven `.focus()` of a non-interactive element, so the ring must
  // hang off `:focus` instead — otherwise sighted keyboard users see focus
  // silently disappear into the alert.
  describe('focus ring on programmatic focus', () => {
    it('uses focus:ring-2 (not focus-visible:ring-2) so .focus() shows the ring', () => {
      render(
        <Alert variant="error" tabIndex={-1}>
          Oops
        </Alert>,
      );
      const alertElement = screen.getByRole('alert');
      expect(alertElement.className).toContain('focus:ring-2');
      expect(alertElement.className).toContain('focus:ring-[var(--accent)]');
      expect(alertElement.className).not.toContain('focus-visible:ring-2');
    });
  });
});
