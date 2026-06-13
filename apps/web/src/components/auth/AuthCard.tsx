import type { ReactNode } from 'react';

interface AuthCardProps {
  children: ReactNode;
}

export default function AuthCard({ children }: AuthCardProps) {
  return (
    <div className="w-full max-w-md mx-auto p-8 bg-[var(--mount-bg)] border-shadow rounded-2xl select-none">
      {children}
    </div>
  );
}
