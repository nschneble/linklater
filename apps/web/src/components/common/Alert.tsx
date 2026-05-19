import type { ReactNode } from 'react';

/**
 * Inline alert banner used for form-level error and success messages.
 *
 * Renders a `<p>` element. The `role` attribute is set automatically:
 * `'alert'` for errors (announced immediately by screen readers) and
 * `'status'` for success (polite announcement).
 *
 * Use directly below the field or form section it relates to.
 */
interface AlertProps {
  /** The message content. Can include inline elements. */
  children: ReactNode;
  /** Additional Tailwind classes for layout overrides (e.g. `"sm:ml-2"`). */
  className?: string;
  /**
   * Font Awesome icon class to render before the children (without `fa-solid`
   * prefix, e.g. `'fa-triangle-exclamation'`). Omit for icon-less alerts.
   */
  icon?: string;
  /** `'error'` renders red; `'success'` renders green. */
  variant: 'error' | 'success';
}

const variantClasses = {
  error:
    "bg-rose-50 [[data-mode='dark']_&]:bg-rose-950/40 border-rose-200 [[data-mode='dark']_&]:border-rose-800 text-rose-700 [[data-mode='dark']_&]:text-rose-400",
  success:
    "bg-emerald-50 [[data-mode='dark']_&]:bg-emerald-950/40 border-emerald-200 [[data-mode='dark']_&]:border-emerald-700 text-emerald-700 [[data-mode='dark']_&]:text-emerald-300",
};

const variantRoles: Record<AlertProps['variant'], string> = {
  error: 'alert',
  success: 'status',
};

export default function Alert({
  children,
  className = '',
  icon,
  variant,
}: AlertProps) {
  return (
    <p
      className={`px-3 py-2 border text-xs rounded-lg ${icon ? 'flex items-center justify-center gap-2' : ''} ${variantClasses[variant]} ${className}`}
      role={variantRoles[variant]}
    >
      {icon && <i className={`fa-solid ${icon} text-xs`} aria-hidden="true" />}
      {children}
    </p>
  );
}
