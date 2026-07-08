import type { OpenAPIV3 } from 'openapi-types';
import SchemaRowCells from './SchemaRowCells';
import { toSchemaRows } from '../../lib/apiDocs/schemaShape';

interface SchemaTableProps {
  caption?: string;
  schema: OpenAPIV3.SchemaObject | undefined;
  depth?: number;
}

/**
 * Renders the schema for an API response. Every nested object / array-of-object
 * property is a collapsible disclosure (WAI-ARIA APG), contracted by default —
 * except a lone top-level property, whose value is expanded so the common
 * single-envelope response reads without a click. Deeper levels stay contracted.
 */
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

  const expandSingleTopLevel = depth === 0 && rows.length === 1;

  return (
    <table className="w-full text-left">
      {caption && (
        <caption className="pb-2 text-[var(--mount-text)] text-sm font-semibold text-left">
          {caption}
        </caption>
      )}
      <tbody>
        {rows.map((row) => (
          <SchemaRowCells
            key={row.name}
            row={row}
            depth={depth}
            defaultExpanded={expandSingleTopLevel}
          />
        ))}
      </tbody>
    </table>
  );
}
