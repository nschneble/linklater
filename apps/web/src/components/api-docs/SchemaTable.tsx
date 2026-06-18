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
 * Reads with horizontal rules only (no per-cell box grid) plus a text
 * hierarchy: column headers and each property NAME (the row header) use the
 * primary `--mount-text`, while the secondary data cells (type, required,
 * description) use the dimmer `--mount-text`'s sibling `--mount-alt-text`. All
 * consume bundle tokens (CONSTRAINT T6) — brand literals when logged out, the
 * active theme when logged in.
 */

interface SchemaTableProps {
  /** Region label rendered as the table's <caption>. */
  caption: string;
  /** Resolved object schema whose properties become rows. */
  schema: OpenAPIV3.SchemaObject | undefined;
  /** Nesting depth, set by the recursive nested case. Top level is 0. */
  depth?: number;
}

/** Shared row-edge: a single bottom rule, generous padding, top-aligned. */
const CELL_BASE =
  'px-3 py-2.5 border-b border-[var(--mount-border)] text-sm align-top';
/** Column header + property-name (row header): primary text, scannable anchor. */
const HEADER_CELL = `${CELL_BASE} text-[var(--mount-text)] font-semibold`;
const NAME_CELL = `${CELL_BASE} text-[var(--mount-text)] font-mono font-normal`;
/** Secondary data cells: dimmer alt text so the name column reads as the anchor. */
const DATA_CELL = `${CELL_BASE} text-[var(--mount-alt-text)]`;

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
    <table className="w-full border-collapse text-left">
      <caption className="pb-2 text-[var(--mount-text)] text-sm font-semibold text-left">
        {caption}
      </caption>
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>
            Property
          </th>
          <th scope="col" className={HEADER_CELL}>
            Type
          </th>
          <th scope="col" className={HEADER_CELL}>
            Required
          </th>
          <th scope="col" className={HEADER_CELL}>
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
        <th scope="row" className={NAME_CELL}>
          {row.name}
        </th>
        <td className={`${DATA_CELL} font-mono`}>{row.typeLabel}</td>
        <td className={DATA_CELL}>{row.required ? 'Required' : 'Optional'}</td>
        <td className={DATA_CELL}>{row.description ?? ''}</td>
      </tr>
      {row.nested && row.nested.kind === 'note' && (
        <tr>
          <td colSpan={4} className={DATA_CELL}>
            Nested object — see full schema.
          </td>
        </tr>
      )}
      {row.nested && row.nested.kind !== 'note' && (
        <tr>
          {/*
           * The nested sub-table sits in a full-width cell. With the per-cell
           * grid gone, a left rule + inset visually contains it as a child of
           * this row rather than letting it merge into the parent rows; the
           * child table's own <caption> is the AT-side anchor.
           */}
          <td colSpan={4} className={`${DATA_CELL} pl-3`}>
            <div className="pl-3 border-l-2 border-[var(--mount-border)]">
              <SchemaTable
                caption={row.nested.label}
                schema={row.nested.schema}
                depth={depth + 1}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
