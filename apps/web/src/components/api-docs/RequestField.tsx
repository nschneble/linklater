import FormInput from '../common/FormInput';
import { fieldDescriptionId, fieldErrorId } from '../../lib/apiDocs/fieldIds';

/**
 * One labeled text input for a single path/query parameter inside the "try it
 * out" form. Wraps the shared token-driven `FormInput` with `surface="mount"`
 * (Wave 6) so the input fill (`--mount-input-bg`), border (`--mount-border`),
 * text (`--mount-text`) and focus ring (`--focus-ring`) all come from the host
 * surface's bundle — brand literals when logged out (pinned by `ApiDocsView`),
 * the active theme when logged in. Adopting `FormInput` deletes the most
 * duplicated input a11y surface and inherits the input bundle contract already
 * mechanized in `bundles.contrast.test.ts`.
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
        className="block text-[var(--mount-text)] text-sm font-semibold"
      >
        {label}{' '}
        <span className="font-normal">
          {required ? '(required)' : '(optional)'}
        </span>
      </label>
      {description && (
        <p
          id={descriptionId}
          className="mt-1 text-[var(--mount-alt-text)] text-xs"
        >
          {description}
        </p>
      )}
      <FormInput
        surface="mount"
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
        className="aria-disabled:opacity-60 aria-disabled:cursor-not-allowed"
      />
      {error ? (
        <p id={errorId} className="mt-1 text-[var(--alert-text)] text-xs">
          {error}
        </p>
      ) : (
        <p id={errorId} className="sr-only" />
      )}
    </div>
  );
}
