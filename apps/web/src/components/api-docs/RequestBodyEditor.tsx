import { fieldDescriptionId, fieldErrorId } from '../../lib/apiDocs/fieldIds';

/**
 * Labeled JSON `<textarea>` for an endpoint's request body inside the "try it
 * out" form. Same a11y contract as `RequestField` (real visible `<label>`,
 * deterministic ids, always-mounted error node, `aria-disabled` + `readOnly`
 * for the inert/logged-out state) — the body just edits free JSON text.
 *
 * `FormInput` is `<input>`-only, so the `<textarea>` can't adopt it directly;
 * it MIRRORS FormInput's `surface="mount"` token set exactly (Wave 6) —
 * `--mount-input-bg` fill, `--mount-border`, `--mount-text`, `--focus-ring` —
 * so the body editor and the parameter fields paint identically and inherit
 * the same input bundle contract mechanized in `bundles.contrast.test.ts`.
 *
 * The parse error is surfaced inline here AND folded into the form-level Alert
 * summary by `RequestForm`; the textarea's `aria-invalid` flips on a parse
 * failure so AT users land on the offending control when focus moves there
 * (CONSTRAINT §3).
 */

interface RequestBodyEditorProps {
  /** Deterministic body field id (see `describeBodyFieldId`). */
  fieldId: string;
  /** Current JSON text (controlled). */
  value: string;
  /** Parse-error message; empty keeps the error node mounted but inert. */
  error: string;
  /** Whether the form is inert (logged-out or token loading). */
  inert: boolean;
  /** Change handler — receives the raw text. */
  onValueChange: (value: string) => void;
}

export default function RequestBodyEditor({
  fieldId,
  value,
  error,
  inert,
  onValueChange,
}: RequestBodyEditorProps) {
  const descriptionId = fieldDescriptionId(fieldId);
  const errorId = fieldErrorId(fieldId);

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    onValueChange(event.target.value);
  }

  return (
    <div>
      <label
        htmlFor={fieldId}
        className="block text-[var(--mount-text)] text-sm font-semibold"
      >
        Request body (JSON)
      </label>
      <p
        id={descriptionId}
        className="mt-1 text-[var(--mount-alt-text)] text-xs"
      >
        Edit the prefilled example, then send the request.
      </p>
      <textarea
        id={fieldId}
        value={value}
        onChange={handleChange}
        rows={8}
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-disabled={inert || undefined}
        readOnly={inert}
        aria-describedby={`${descriptionId} ${errorId}`}
        className="block w-full mt-1 px-3 py-2 bg-[var(--mount-input-bg)] border border-[var(--mount-border)] text-[var(--mount-text)] text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-transparent aria-disabled:opacity-60 aria-disabled:cursor-not-allowed rounded-lg"
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
