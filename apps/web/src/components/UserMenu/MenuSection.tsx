import type { ReactNode } from 'react';

/**
 * A visually separated group of items within the `UserMenu` dropdown.
 * Renders a bottom border and an optional small uppercase section label above
 * the children.
 */
interface MenuSectionProps {
  /** The items to group, typically one or more `MenuItem` components. */
  children: ReactNode;
  /** Optional section heading shown above the children in small caps. */
  label?: string;
  /** Additional Tailwind classes, typically for horizontal padding overrides. */
  className?: string;
}

/**
 * Groups related `MenuItem` components within the `UserMenu` with a visual
 * divider. Used to separate navigation, preferences, and logout sections.
 */
export default function MenuSection({
  children,
  label,
  className = '',
}: MenuSectionProps) {
  return (
    <div className={`pb-2 mb-2 border-b border-[var(--border)] ${className}`}>
      {label && (
        <p className="text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-tight font-semibold">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}
