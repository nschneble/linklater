import type { ButtonHTMLAttributes } from 'react';

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export default function PrimaryButton({
  children,
  className = '',
  type = 'submit',
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 pl-3.5 pr-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] border-shadow-[var(--accent)] hover:border-shadow-[var(--accent-hover)] border-shadow-md hover:border-shadow-md text-[var(--accent-fg)] text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-lg disabled:opacity-60 transition disabled:cursor-wait ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
