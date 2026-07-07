import { describeType } from '../../lib/apiDocs/schemaShape';
import type { NormalizedParameter } from '../../lib/openapi';

/**
 * Read-only renderer for ONE location's worth of endpoint parameters. Sibling
 * to <SchemaTable>: it reuses the identical a11y contract – a real <table> (not
 * a <dl>; CONSTRAINT T1) with a <caption> naming the region (CONSTRAINT T2),
 * column headers as <th scope="col">, and each parameter name as
 * <th scope="row"> (CONSTRAINT T2). Required-ness is conveyed by TEXT
 * ("Yes" / "No") in the "Required" column, never color alone (CONSTRAINT T3).
 *
 * Parameters never nest, so this stays flat – the column set differs from
 * <SchemaTable> (no nested rows), which is why this is a focused sibling rather
 * than a parameterized SchemaTable. The parameters passed in are already a
 * single location (all query OR all path); the caller partitions the endpoint's
 * parameters and picks the location-specific <caption> ("Query Parameters" /
 * "Path Parameters"), so the table carries no per-row location cell – the
 * caption alone conveys where the parameters live. The Type column reuses the
 * shared `describeType` helper so type labels read identically across both
 * tables. It mirrors SchemaTable's horizontal-rule styling + text hierarchy:
 * column headers and each parameter NAME use the primary `--mount-text`; the
 * secondary data cells use the dimmer `--mount-alt-text`. All consume
 * `--mount-*` bundle tokens (brand literals when logged out, active theme when
 * logged in).
 */

interface ParameterTableProps {
  /** Location-specific label rendered as the table's <caption>. */
  caption: string;
  /**
   * Resolved parameters for a SINGLE location (all query or all path). The
   * caller renders nothing when this is empty.
   */
  parameters: NormalizedParameter[];
}

/** Shared row-edge: a single bottom rule, generous padding, top-aligned. */
const CELL_BASE =
  'px-3 py-2.5 border-b border-[var(--mount-border)] text-sm align-top';
/** Column header + parameter-name (row header): primary text, scannable anchor. */
const HEADER_CELL = `${CELL_BASE} text-[var(--mount-text)] font-semibold`;
const NAME_CELL = `${CELL_BASE} text-[var(--mount-text)] font-mono font-normal`;
/** Secondary data cells: dimmer alt text so the name column reads as the anchor. */
const DATA_CELL = `${CELL_BASE} text-[var(--mount-alt-text)]`;

export default function ParameterTable({
  caption,
  parameters,
}: ParameterTableProps) {
  return (
    <table className="w-full border-collapse text-left">
      <caption className="pb-2 text-[var(--mount-text)] text-sm font-semibold text-left">
        {caption}
      </caption>
      <thead>
        <tr>
          <th scope="col" className={HEADER_CELL}>
            Parameter
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
        {parameters.map((parameter) => (
          <tr key={parameter.name}>
            <th scope="row" className={NAME_CELL}>
              {parameter.name}
            </th>
            <td className={`${DATA_CELL} font-mono`}>
              {describeType(parameter.schema)}
            </td>
            <td className={DATA_CELL}>{parameter.required ? 'Yes' : 'No'}</td>
            <td className={DATA_CELL}>{parameter.description ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
