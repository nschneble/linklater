// TODO/FIXME: delete this component?
import { useState, type ChangeEvent } from 'react';
import { useTransientState } from '../../lib/hooks/useTransientState';

interface BrandTokenInputProps {
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
 * Renders against the landing/marketing brand chrome (`bg-hit-man` gradient,
 * `midnight`/`boyhood`/`dazed`/`confused`/`sunrise` palette) rather than the
 * authenticated app's bundle vocabulary. Self-contained — does NOT use the
 * shared `FormInput` / `IconButton` components or the `surface` plumbing,
 * because the user-selected theme cannot meet WCAG against the fixed
 * gradient (a11y-lead wave 22b-style brand-locked path).
 *
 * Always renders masked on mount (show/hide state is not persisted) and
 * delegates value persistence to the parent (which writes to sessionStorage).
 * Validates only on blur to avoid spamming screen-reader announcements
 * during typing.
 *
 * Live-region announcements are intentionally generic ("pasted", "cleared")
 * and never include the token value itself.
 *
 * Contrast pairs (worst-case gradient stop `#0a0812`):
 * - label `text-dazed` 16.4:1 (SC 1.4.3)
 * - help / code `text-confused` 6.4:1 / `text-dazed` 16.4:1
 * - input border `border-confused` 6.4:1 (SC 1.4.11 — NOT `border-boyhood`,
 *   which fails at 2.0:1)
 * - input fill `bg-midnight` (#1a1530), text inside 14.0:1
 * - placeholder `placeholder:text-confused` 5.0:1
 * - focus ring `focus-visible:ring-dazed` 16.4:1 (NEVER `ring-sunrise` —
 *   fails 1.4.11 at 2.93:1 on the gradient)
 * - default button ring `ring-confused` 6.4:1
 * - error icon-prefixed `text-dazed` (16.4:1) + `border-l-2 border-sunrise`
 *   (shape redundancy carries SC 1.4.11; sunrise body text would fail at
 *   2.93:1).
 */
export default function BrandTokenInput({
  value,
  onChange,
}: BrandTokenInputProps) {
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

  const isClearDisabled = value.length === 0;

  return (
    <div className="space-y-3">
      <label
        className="block text-dazed text-sm font-medium"
        htmlFor="api-docs-token-input"
      >
        Personal access token
      </label>
      <div className="flex flex-wrap items-stretch gap-2">
        <div className="grow basis-64">
          <input
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
            className="block w-full px-3 py-2 bg-midnight border border-confused text-dazed placeholder:text-confused text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dazed rounded-lg transition duration-200"
          />
        </div>
        <button
          type="button"
          className="group inline-flex items-center gap-2 px-3 py-2 active:scale-[0.96] border border-confused hover:border-dazed text-confused hover:text-dazed text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dazed rounded-lg transition duration-200 cursor-pointer"
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
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-2 active:scale-[0.96] border border-confused hover:border-dazed text-confused hover:text-dazed text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dazed rounded-lg transition duration-200 cursor-pointer"
          onClick={() => void handlePaste()}
        >
          <i aria-hidden="true" className="fa-solid fa-paste text-[0.7rem]" />
          Paste from clipboard
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-2 active:scale-[0.96] text-confused hover:text-dazed aria-disabled:text-confused/60 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dazed rounded-lg transition duration-200 cursor-pointer aria-disabled:cursor-not-allowed"
          onClick={handleClear}
          aria-disabled={isClearDisabled || undefined}
          disabled={isClearDisabled}
        >
          Clear
        </button>
      </div>
      <p className="text-confused text-xs" id="api-docs-token-help">
        This token is remembered for this tab only. Tokens start with{' '}
        <code className="text-dazed font-mono">ltk_</code>.
      </p>
      {hasValidationError && (
        <p
          className="flex items-start gap-2 pl-2 border-l-2 border-sunrise text-dazed text-xs"
          id="api-docs-token-error"
          role="alert"
        >
          <i
            aria-hidden="true"
            className="fa-solid fa-triangle-exclamation mt-0.5 text-sunrise text-[0.7rem]"
          />
          <span>
            Personal access tokens start with{' '}
            <code className="font-mono">ltk_</code>.
          </span>
        </p>
      )}
      <span aria-atomic="true" className="sr-only" role="status">
        {announcement}
      </span>
    </div>
  );
}
