import FormInput from '../common/FormInput';
import IconButton from '../common/IconButton';
import { useState, type ChangeEvent } from 'react';
import { useTransientState } from '../../lib/hooks/useTransientState';

interface TokenInputProps {
  /** Current token value (controlled). */
  value: string;
  /** Called when the value changes (typed, pasted, or cleared). */
  onChange: (value: string) => void;
}

type PasteState = 'idle' | 'pasted' | 'failed';
type ClearState = 'idle' | 'cleared';

/**
 * Personal access token input for the API docs page.
 *
 * Always renders masked on mount (show/hide state is not persisted) and
 * delegates value persistence to the parent (which writes to sessionStorage).
 * Validates only on blur to avoid spamming screen-reader announcements
 * during typing.
 *
 * Live-region announcements are intentionally generic ("pasted", "cleared")
 * and never include the token value itself.
 */
export default function TokenInput({ value, onChange }: TokenInputProps) {
  const [showToken, setShowToken] = useState(false);
  const [hasBlurred, setHasBlurred] = useState(false);
  const [pasteState, setPasteState] = useState<PasteState>('idle');
  const [clearState, setClearState] = useState<ClearState>('idle');

  // Reset transient announcements after a short delay so the live region
  // returns to empty and is ready to announce the next change.
  useTransientState(pasteState, 'idle', setPasteState);
  useTransientState(clearState, 'idle', setClearState);

  const trimmed = value.trim();
  const hasValidationError =
    hasBlurred && trimmed.length > 0 && !trimmed.startsWith('ltk_');

  // Derive a single announcement so overlapping transient states never
  // produce a concatenated run-together message in the live region.
  let announcement = '';
  if (pasteState === 'pasted') {
    announcement = 'Token pasted from clipboard';
  } else if (pasteState === 'failed') {
    announcement = 'Clipboard access denied. Paste manually with the keyboard.';
  } else if (clearState === 'cleared') {
    announcement = 'Token cleared';
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim().length === 0) {
        setPasteState('failed');
        return;
      }
      onChange(text.trim());
      setPasteState('pasted');
      setHasBlurred(true);
    } catch {
      // Clipboard read denied — fall back to manual paste with ⌘V.
      setPasteState('failed');
    }
  };

  const handleClear = () => {
    onChange('');
    setHasBlurred(false);
    setClearState('cleared');
  };

  return (
    <div className="space-y-2">
      <label
        className="block text-[var(--text-muted)] text-xs font-medium"
        htmlFor="api-docs-token-input"
      >
        Personal access token
      </label>
      <div className="flex flex-wrap items-stretch gap-2">
        <div className="grow basis-64">
          <FormInput
            id="api-docs-token-input"
            type={showToken ? 'text' : 'password'}
            value={value}
            onChange={handleChange}
            onBlur={() => setHasBlurred(true)}
            autoComplete="off"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            inputMode="text"
            placeholder="ltk_…"
            aria-describedby={
              hasValidationError
                ? 'api-docs-token-help api-docs-token-error'
                : 'api-docs-token-help'
            }
            aria-invalid={hasValidationError || undefined}
          />
        </div>
        <IconButton
          className="group"
          aria-pressed={showToken}
          aria-label={showToken ? 'Hide token' : 'Show token'}
          onClick={() => setShowToken((shown) => !shown)}
        >
          <i
            aria-hidden="true"
            className="fa-solid fa-eye text-[0.7rem] group-aria-pressed:hidden"
          />
          <i
            aria-hidden="true"
            className="fa-solid fa-eye-slash text-[0.7rem] hidden group-aria-pressed:inline"
          />
        </IconButton>
        <IconButton onClick={() => void handlePaste()}>
          <i aria-hidden="true" className="fa-solid fa-paste text-[0.7rem]" />
          Paste from clipboard
        </IconButton>
        <IconButton
          variant="ghost"
          onClick={handleClear}
          aria-disabled={value.length === 0 || undefined}
          disabled={value.length === 0}
        >
          Clear
        </IconButton>
      </div>
      <p className="text-[var(--text-muted)] text-xs" id="api-docs-token-help">
        This token is remembered for this tab only. Tokens start with{' '}
        <code className="text-[var(--text)] font-mono">ltk_</code>.
      </p>
      <p
        className="text-rose-700 [[data-mode='dark']_&]:text-rose-300 text-xs"
        id="api-docs-token-error"
        role="alert"
      >
        {hasValidationError && (
          <>
            Personal access tokens start with{' '}
            <code className="font-mono">ltk_</code>.
          </>
        )}
      </p>
      <span aria-atomic="true" className="sr-only" role="status">
        {announcement}
      </span>
    </div>
  );
}
