interface LoadingIndicatorProps {
  message: string;
}

/**
 * The spinner + polite sr-only status shared by every transient full-screen
 * loading state. Callers own the surrounding wrapper (its layout and theme);
 * this renders only the announced status and the decorative spinning icon so
 * the pair stays identical wherever it appears.
 */
export default function LoadingIndicator({ message }: LoadingIndicatorProps) {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
      <i
        className="fa-solid fa-arrows-rotate fa-spin text-4xl opacity-50"
        aria-hidden="true"
      />
    </>
  );
}
