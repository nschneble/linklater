import {
  BORDER,
  ERROR_TEXT,
  FOCUS_RING,
  TEXT,
} from '../../lib/apiDocs/apiDocsColors';
import { fieldDescriptionId, fieldErrorId } from '../../lib/apiDocs/fieldIds';

/**
 * One labeled text input for a single path/query parameter inside the "try it
 * out" form. Replicates the token-based `FormInput` a11y CONTRACT — a real
 * visible `<label htmlFor>` (never a placeholder), native attribute
 * passthrough — but paints brand-locked literals (CONSTRAINT §9), because the
 * docs page carries brand chrome where `var(--mount-…)` resolves to nothing.
 *
 * Ids are deterministic (CONSTRAINT §1/E4): the caller passes a `fieldId` built
 * from the endpoint heading; the description (`-desc`) and error (`-error`)
 * nodes hang off it. The error node is always mounted (empty when valid) so the
 * `aria-describedby` target never dangles — the same "empty-but-present" trick
 * the shared `Alert` uses.
 *
 * Logged-out / loading state is conveyed via `aria-disabled` + `readOnly`
 * (CONSTRAINT §6), NOT native `disabled`: the field stays focusable and in the
 * AT tree (no dead-end), and rejects input. Styling is driven off the
 * `aria-disabled` attribute via a Tailwind variant, not a JS ternary.
 */

interface RequestFieldProps {
  /** Deterministic field id (see `buildFieldId`). */
  fieldId: string;
  /** Visible label text — the parameter name. */
  label: string;
  /** Whether the parameter is required (drives the "(required)" text + native flag). */
  required: boolean;
  /** Optional human description, rendered in the `-desc` node. */
  description?: string;
  /** Current input value (controlled). */
  value: string;
  /** Validation message; empty string keeps the error node mounted but inert. */
  error: string;
  /** Whether the form is inert (logged-out or token loading). */
  inert: boolean;
  /** Change handler — receives the raw string value. */
  onValueChange: (value: string) => void;
}

export default function RequestField({
  fieldId,
  label,
  required,
  description,
  value,
  error,
  inert,
  onValueChange,
}: RequestFieldProps) {
  const descriptionId = fieldDescriptionId(fieldId);
  const errorId = fieldErrorId(fieldId);

  // Describe by the (always-present) description node when there is text, and
  // always by the error node — empty error keeps the reference non-dangling.
  const describedBy = [description ? descriptionId : null, errorId]
    .filter(Boolean)
    .join(' ');

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    onValueChange(event.target.value);
  }

  return (
    <div className="mb-3 last:mb-0">
      <label
        htmlFor={fieldId}
        className="block text-sm font-semibold"
        style={{ color: TEXT }}
      >
        {label}{' '}
        <span className="font-normal">
          {required ? '(required)' : '(optional)'}
        </span>
      </label>
      {description && (
        <p id={descriptionId} className="mt-1 text-xs" style={{ color: TEXT }}>
          {description}
        </p>
      )}
      <input
        id={fieldId}
        type="text"
        value={value}
        onChange={handleChange}
        required={required}
        aria-required={required}
        aria-invalid={error ? true : undefined}
        aria-disabled={inert || undefined}
        readOnly={inert}
        aria-describedby={describedBy}
        className="block w-full mt-1 px-3 py-2 border text-sm rounded-lg focus:outline-none focus:ring-2 aria-disabled:opacity-60 aria-disabled:cursor-not-allowed"
        style={
          {
            color: TEXT,
            borderColor: BORDER,
            '--tw-ring-color': FOCUS_RING,
          } as React.CSSProperties
        }
      />
      {error ? (
        <p id={errorId} className="mt-1 text-xs" style={{ color: ERROR_TEXT }}>
          {error}
        </p>
      ) : (
        <p id={errorId} className="sr-only" />
      )}
    </div>
  );
}
