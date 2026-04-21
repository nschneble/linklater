import type { ReactNode } from 'react';

interface AlertProps {
  children: ReactNode;
  className?: string;
  variant: 'error' | 'success';
}

const variantClasses = {
  error: 'bg-rose-950/40 border-rose-800 text-rose-400',
  success: 'bg-emerald-950/40 border-emerald-700 text-emerald-300',
};

const variantRoles: Record<AlertProps['variant'], string> = {
  error: 'alert',
  success: 'status',
};

export default function Alert({
  children,
  className = '',
  variant,
}: AlertProps) {
  return (
    <p
      className={`px-3 py-2 border text-xs rounded-lg ${variantClasses[variant]} ${className}`}
      role={variantRoles[variant]}
    >
      {children}
    </p>
  );
}
