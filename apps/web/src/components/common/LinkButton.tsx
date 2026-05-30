import type { ButtonHTMLAttributes, Ref } from 'react';
import { type ReactNode } from 'react';

/**
 * Inline link-style button for lightweight in-page actions (e.g. "Back to
 * login", "Resend verification email"). Renders as `<button type="button">`
 * so it does not accidentally submit a form it is placed inside.
 */
interface LinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
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
