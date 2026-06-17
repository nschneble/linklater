import { describeType } from '../../lib/apiDocs/schemaShape';
import type { NormalizedParameter } from '../../lib/openapi';

/**
 * Read-only renderer for an endpoint's path & query parameters. Sibling to
 * <SchemaTable>: it reuses the identical a11y contract — a real <table> (not a
 * <dl>; CONSTRAINT T1) with a <caption> naming the region (CONSTRAINT T2),
 * column headers as <th scope="col">, and each parameter name as
 * <th scope="row"> (CONSTRAINT T2). Required-ness is conveyed by TEXT
 * ("Required" / "Optional"), never color alone (CONSTRAINT T3).
 *
 * Parameters never nest, so this stays flat — the column set differs from
 * <SchemaTable> (it adds an "In" column for path vs query and has no nested
 * rows), which is why this is a focused sibling rather than a parameterized
 * SchemaTable. The Type column reuses the shared `describeType` helper so type
 * labels read identically across both tables. Colors consume `--mount-*`
 * bundle tokens (brand literals when logged out, active theme when logged in).
 */

interface ParameterTableProps {
  /** Region label rendered as the table's <caption>. */
  caption: string;
  /** Resolved parameters; the caller renders nothing when this is empty. */
  parameters: NormalizedParameter[];
}

const CELL_CLASS =
  'px-3 py-2 border border-[var(--mount-border)] text-[var(--mount-text)] text-sm align-top';

export default function ParameterTable({
  caption,
  parameters,
}: ParameterTableProps) {
  return (
    <table className="w-full border border-[var(--mount-border)] border-collapse text-left">
      <caption className="pb-2 text-[var(--mount-text)] text-sm font-semibold text-left">
        {caption}
      </caption>
      <thead>
        <tr>
          <th scope="col" className={`${CELL_CLASS} font-semibold`}>
            Parameter
          </th>
          <th scope="col" className={`${CELL_CLASS} font-semibold`}>
            In
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
        {parameters.map((parameter) => (
          <tr key={`${parameter.location}-${parameter.name}`}>
            <th scope="row" className={`${CELL_CLASS} font-mono font-normal`}>
              {parameter.name}
            </th>
            <td className={CELL_CLASS}>{parameter.location}</td>
            <td className={`${CELL_CLASS} font-mono`}>
              {describeType(parameter.schema)}
            </td>
            <td className={CELL_CLASS}>
              {parameter.required ? 'Required' : 'Optional'}
            </td>
            <td className={CELL_CLASS}>{parameter.description ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
