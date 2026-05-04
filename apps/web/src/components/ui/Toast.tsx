import { useEffect } from 'react';

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export default function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-[var(--text)] border-shadow text-[var(--bg)] text-sm font-medium rounded-full animate-fade-in-up"
    >
      <i className="fa-solid fa-check text-xs" aria-hidden="true" />
      {message}
    </div>
  );
}
