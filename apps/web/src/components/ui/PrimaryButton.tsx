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
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-fg)] text-sm font-semibold shadow-md rounded-lg disabled:opacity-60 disabled:cursor-wait transition ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
