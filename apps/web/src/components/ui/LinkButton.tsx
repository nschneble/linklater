import { type ReactNode } from 'react';

interface LinkButtonProps {
  children: ReactNode;
  onClick: () => void;
}

export default function LinkButton({ children, onClick }: LinkButtonProps) {
  return (
    <button
      type="button"
      className="text-[var(--text-muted)] hover:text-[var(--accent)] text-xs underline underline-offset-3 cursor-pointer"
      onClick={onClick}
    >
      {children}
    </button>
  );
}
