import type { ReactNode } from 'react';
import { FOCUS_RING } from '../../lib/styles';

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
      className={`relative z-10 w-full font-semibold text-center ${FOCUS_RING} rounded-full transition-colors duration-200 ${
        isActive
          ? 'text-[var(--bg)]'
          : 'text-[var(--text-muted)] cursor-pointer'
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
