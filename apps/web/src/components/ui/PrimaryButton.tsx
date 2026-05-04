import type { ButtonHTMLAttributes } from 'react';
import { DISABLED, FOCUS_RING } from '../../lib/styles';

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export default function PrimaryButton({
  children,
  className = '',
  type = 'submit',
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 pl-3.5 pr-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] border-shadow hover:border-shadow text-[var(--accent-fg)] text-xs font-semibold ${FOCUS_RING} rounded-full cursor-pointer ${DISABLED} transition ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
