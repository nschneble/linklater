import { toSchemaRows } from '../../lib/apiDocs/schemaShape';
import type { SchemaRow } from '../../lib/apiDocs/schemaShape';
import type { OpenAPIV3 } from 'openapi-types';

/**
 * Read-only schema renderer (CONSTRAINT R2). A real <table> — not a <dl> or
 * nested lists (CONSTRAINT T1) — with a caller-supplied <caption> naming the
 * region (e.g. "Request body", "200 response body"; CONSTRAINT T2), column
 * headers as <th scope="col">, and each property name as <th scope="row">.
 *
 * Required-ness is conveyed by TEXT ("Required" / "Optional"), never color or
 * an icon alone (CONSTRAINT T3). A nested object or array-of-object renders as
 * a child table one level deep with its own caption (CONSTRAINT T4); anything
 * deeper shows a text note. An empty schema renders a text fallback rather
 * than an empty table (CONSTRAINT T5).
 *
 * Text + gridlines consume the `--mount-text` / `--mount-border` bundle tokens
 * (CONSTRAINT T6) — brand literals when logged out, the active theme when
 * logged in.
 */

interface SchemaTableProps {
  /** Region label rendered as the table's <caption>. */
  caption: string;
  /** Resolved object schema whose properties become rows. */
  schema: OpenAPIV3.SchemaObject | undefined;
  /** Nesting depth, set by the recursive nested case. Top level is 0. */
  depth?: number;
}

const CELL_CLASS =
  'px-3 py-2 border border-[var(--mount-border)] text-[var(--mount-text)] text-sm align-top';

export default function SchemaTable({
  caption,
  schema,
  depth = 0,
}: SchemaTableProps) {
  const rows = toSchemaRows(schema, depth);

  if (rows.length === 0) {
    return (
      <p className="text-[var(--mount-text)] text-sm">
        <span className="font-semibold">{caption}:</span> No properties.
      </p>
    );
  }

  return (
    <table className="w-full border border-[var(--mount-border)] border-collapse text-left">
      <caption className="pb-2 text-[var(--mount-text)] text-sm font-semibold text-left">
        {caption}
      </caption>
      <thead>
        <tr>
          <th scope="col" className={`${CELL_CLASS} font-semibold`}>
            Property
          </th>
          <th scope="col" className={`${CELL_CLASS} font-semibold`}>
            Type
          </th>
          <th scope="col" className={`${CELL_CLASS} font-semibold`}>
            Required
          </th>
          <th scope="col" className={`${CELL_CLASS} font-semibold`}>
            Description
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <SchemaRowCells key={row.name} row={row} depth={depth} />
        ))}
      </tbody>
    </table>
  );
}

interface SchemaRowCellsProps {
  row: SchemaRow;
  depth: number;
}

/** One property row, plus a full-width nested-table row when applicable. */
function SchemaRowCells({ row, depth }: SchemaRowCellsProps) {
  return (
    <>
      <tr>
        <th scope="row" className={`${CELL_CLASS} font-mono font-normal`}>
          {row.name}
        </th>
        <td className={`${CELL_CLASS} font-mono`}>{row.typeLabel}</td>
        <td className={CELL_CLASS}>{row.required ? 'Required' : 'Optional'}</td>
        <td className={CELL_CLASS}>{row.description ?? ''}</td>
      </tr>
      {row.nested && row.nested.kind === 'note' && (
        <tr>
          <td colSpan={4} className={CELL_CLASS}>
            Nested object — see full schema.
          </td>
        </tr>
      )}
      {row.nested && row.nested.kind !== 'note' && (
        <tr>
          <td colSpan={4} className={CELL_CLASS}>
            <SchemaTable
              caption={row.nested.label}
              schema={row.nested.schema}
              depth={depth + 1}
            />
          </td>
        </tr>
      )}
    </>
  );
}
