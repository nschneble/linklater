import type { ReactNode } from 'react';

interface StatusBadgeProps {
  /**
   * `'success'` renders a green pill (e.g. Verified, Connected, Enabled),
   * `'warning'` renders an amber pill (e.g. Unverified), `'info'` renders
   * a blue pill (e.g. Recommended).
   */
  variant: 'success' | 'warning' | 'info';
  /** Optional Font Awesome icon class (e.g. `'fa-solid fa-circle-check'`). */
  icon?: string;
  /** Visible label text. */
  children: ReactNode;
}

const variantClasses = {
  success:
    "bg-emerald-100 [[data-mode='dark']_&]:bg-emerald-950/20 border-emerald-300 [[data-mode='dark']_&]:border-emerald-800/40 text-emerald-700 [[data-mode='dark']_&]:text-emerald-400",
  warning:
    "bg-amber-100 [[data-mode='dark']_&]:bg-amber-950/20 border-amber-300 [[data-mode='dark']_&]:border-amber-800/40 text-amber-700 [[data-mode='dark']_&]:text-amber-300 [[data-theme='nouvelle-vague']_&]:bg-[var(--bg-elevated)] [[data-theme='nouvelle-vague']_&]:border-[var(--border)] [[data-theme='nouvelle-vague']_&]:text-[var(--text-muted)] [[data-theme='nouvelle-vague'][data-mode='dark']_&]:bg-[var(--bg-elevated)] [[data-theme='nouvelle-vague'][data-mode='dark']_&]:border-[var(--border)] [[data-theme='nouvelle-vague'][data-mode='dark']_&]:text-[var(--text-muted)]",
  info: "bg-blue-100 [[data-mode='dark']_&]:bg-blue-950/20 border-blue-300 [[data-mode='dark']_&]:border-blue-800/40 text-blue-700 [[data-mode='dark']_&]:text-blue-400 [[data-theme='nouvelle-vague']_&]:bg-[var(--bg-elevated)] [[data-theme='nouvelle-vague']_&]:border-[var(--border)] [[data-theme='nouvelle-vague']_&]:text-[var(--text-muted)] [[data-theme='nouvelle-vague'][data-mode='dark']_&]:bg-[var(--bg-elevated)] [[data-theme='nouvelle-vague'][data-mode='dark']_&]:border-[var(--border)] [[data-theme='nouvelle-vague'][data-mode='dark']_&]:text-[var(--text-muted)]",
};

/**
 * Compact pill-shaped status indicator used next to labels in settings —
 * Verified/Unverified email, Connected social provider, Enabled 2FA, etc.
 */
export default function StatusBadge({
  variant,
  icon,
  children,
}: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 border text-xs rounded-full ${variantClasses[variant]}`}
    >
      {icon && <i className={`${icon} text-[0.6rem]`} aria-hidden="true" />}
      {children}
    </span>
  );
}
