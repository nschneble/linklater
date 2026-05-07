import { type ReactNode } from 'react';

/**
 * Inline text button styled to look like a hyperlink. Used for secondary
 * in-page actions that would look too heavy as a full button (e.g. "Back to
 * login", "Resend verification email").
 *
 * Renders as a `<button type="button">` so it does not accidentally submit
 * a form it is placed inside.
 */
interface LinkButtonProps {
  /** The visible link text. */
  children: ReactNode;
  /** Called when the button is clicked. */
  onClick: () => void;
}

export default function LinkButton({ children, onClick }: LinkButtonProps) {
  return (
    <button
      type="button"
      className="text-[var(--text-muted)] hover:text-[var(--accent)] text-xs underline underline-offset-3 cursor-pointer"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
