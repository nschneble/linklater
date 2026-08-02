import { describeType } from '../../lib/apiDocs/schemaShape';
import type { NormalizedParameter } from '../../lib/openapi';

interface ParameterTableProps {
  caption: string;
  parameters: NormalizedParameter[];
}

/**
 * Renders the query or path parameters for an API endpoint.
 */
export default function ParameterTable({
  caption,
  parameters,
}: ParameterTableProps) {
  return (
    <table className="w-full text-left">
      <caption className="pb-2 text-[var(--mount-text)] text-sm font-semibold text-left">
        {caption}
      </caption>
      <tbody>
        {parameters.map((parameter) => (
          <tr key={parameter.name}>
            <th
              scope="row"
              className="px-3 py-2.5 text-[var(--mount-text)] text-sm text-wrap font-mono font-normal"
            >
              {parameter.name}
              {parameter.required ? '' : '?'}:{' '}
              <span className="text-[var(--mount-subtle-text)]">
                {describeType(parameter.schema)}
              </span>
              <p className="text-[var(--mount-alt-text)] font-sans">
                {parameter.description ?? ''}
              </p>
            </th>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
