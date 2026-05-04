import type { ReactNode } from 'react';

interface MenuSectionProps {
  children: ReactNode;
  label?: string;
  className?: string;
}

export default function MenuSection({
  children,
  label,
  className = '',
}: MenuSectionProps) {
  return (
    <div className={`pb-2 mb-2 border-b border-[var(--border)] ${className}`}>
      {label && (
        <p className="px-3 text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-tight font-semibold">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}
