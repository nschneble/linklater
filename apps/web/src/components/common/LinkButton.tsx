import type { ButtonHTMLAttributes } from 'react';
import { type ReactNode } from 'react';

/**
 * Inline text button styled to look like a hyperlink. Used for secondary
 * in-page actions that would look too heavy as a full button (e.g. "Back to
 * login", "Resend verification email").
 *
 * Renders as a `<button type="button">` so it does not accidentally submit
 * a form it is placed inside.
 */
interface LinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The visible link text. */
  children: ReactNode;
  /** When true, the button is non-interactive and visually dimmed. */
  disabled?: boolean;
  /** Called when the button is clicked. */
  onClick: () => void;
}

export default function LinkButton({
  children,
  className = '',
  disabled,
  onClick,
  ...props
}: LinkButtonProps) {
  return (
    <button
      type="button"
      className={`text-[var(--text-muted)] hover:text-[var(--accent)] text-xs underline underline-offset-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.96] transition duration-200 ${className}`}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
