import type { InputHTMLAttributes } from 'react';

type FormInputProps = InputHTMLAttributes<HTMLInputElement>;

export default function FormInput({
  className = '',
  ...props
}: FormInputProps) {
  return (
    <input
      className={`block w-full mt-1 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] placeholder:text-[var(--text-subtle)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent rounded-lg ${className}`}
      {...props}
    />
  );
}
