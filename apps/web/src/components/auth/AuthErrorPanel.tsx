import Alert from '../common/Alert';
import LinkButton from '../common/LinkButton';

interface AuthErrorPanelProps {
  errorMessage: string | null;
  explanation: string;
  onBackToLogin: () => void;
  backLabel?: string;
}

/**
 * Shared error state for the OAuth callback and magic-link verify pages.
 *
 * Renders an assertive `Alert` (the `role="alert"` announces on conditional
 * mount), a contextual explanation paragraph, and a "Back to login" button.
 * Intentionally presentational — callers own `useNavigate` and pass the
 * handler. Does not focus anything on mount; both call sites rely on the
 * Alert's live region to announce the error.
 */
export default function AuthErrorPanel({
  errorMessage,
  explanation,
  onBackToLogin,
  backLabel = 'Back to login',
}: AuthErrorPanelProps) {
  return (
    <>
      <Alert className="mb-2" icon="fa-triangle-exclamation" variant="error">
        {errorMessage}
      </Alert>
      <p className="mb-6 text-[var(--mount-alt-text)] text-sm">{explanation}</p>
      <LinkButton surface="mount" onClick={onBackToLogin}>
        {backLabel}
      </LinkButton>
    </>
  );
}
