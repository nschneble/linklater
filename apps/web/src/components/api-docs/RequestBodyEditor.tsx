import {
  BORDER,
  ERROR_TEXT,
  FOCUS_RING,
  TEXT,
} from '../../lib/apiDocs/apiDocsColors';
import { fieldDescriptionId, fieldErrorId } from '../../lib/apiDocs/fieldIds';

/**
 * Labeled JSON `<textarea>` for an endpoint's request body inside the "try it
 * out" form. Same a11y contract as `RequestField` (real visible `<label>`,
 * deterministic ids, always-mounted error node, `aria-disabled` + `readOnly`
 * for the inert/logged-out state) — the body just edits free JSON text.
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
        className="block text-sm font-semibold"
        style={{ color: TEXT }}
      >
        Request body (JSON)
      </label>
      <p id={descriptionId} className="mt-1 text-xs" style={{ color: TEXT }}>
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
        className="block w-full mt-1 px-3 py-2 border text-xs font-mono rounded-lg focus:outline-none focus:ring-2 aria-disabled:opacity-60 aria-disabled:cursor-not-allowed"
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
