import { useCallback, useEffect, useState } from 'react';
import { FOCUS_RING } from '../../lib/styles';

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

export default function Toast({ message, onDismiss }: ToastProps) {
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(onDismiss, 150);
  }, [onDismiss]);

  useEffect(() => {
    const timer = setTimeout(dismiss, 3000);
    return () => clearTimeout(timer);
  }, [dismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 bg-[var(--text)] border-shadow text-[var(--bg)] text-sm font-medium rounded-full ${
        exiting ? 'animate-fade-out-down' : 'animate-fade-in-up'
      }`}
    >
      <i className="fa-solid fa-check text-xs" aria-hidden="true" />
      {message}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={dismiss}
        className={`ml-1 opacity-60 hover:opacity-100 transition-opacity cursor-pointer ${FOCUS_RING} rounded-full`}
      >
        <i className="fa-solid fa-xmark text-xs" aria-hidden="true" />
      </button>
    </div>
  );
}
