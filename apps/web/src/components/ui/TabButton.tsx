import type { ReactNode } from 'react';

interface TabButtonProps {
  children: ReactNode;
  isActive: boolean;
  onClick: () => void;
  className?: string;
}

export default function TabButton({
  children,
  isActive,
  onClick,
  className = '',
}: TabButtonProps) {
  return (
    <button
      className={`rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
        isActive
          ? 'bg-[var(--text)] text-[var(--bg)] font-semibold'
          : 'hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] cursor-pointer'
      } ${className}`}
      type="button"
      role="tab"
      onClick={onClick}
      aria-selected={isActive}
    >
      {children}
    </button>
  );
}
