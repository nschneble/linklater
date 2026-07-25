import SchemaDisclosureToggle from './SchemaDisclosureToggle';
import SchemaTable from './SchemaTable';
import { useId, useState } from 'react';
import type { SchemaRow } from '../../lib/apiDocs/schemaShape';

const CELL_BASE = 'px-3 py-2.5 text-sm align-top';
const NAME_CELL = `${CELL_BASE} text-[var(--mount-text)] font-mono font-normal`;
const DATA_CELL = `${CELL_BASE} text-[var(--mount-alt-text)]`;

interface SchemaRowCellsProps {
  row: SchemaRow;
  depth: number;
  defaultExpanded: boolean;
}

/**
 * One property row. A nested object / array-of-object row gains a disclosure
 * toggle whose panel is a kept-mounted sibling <tr> hidden via the `hidden`
 * attribute — which drops the panel and its nested triggers from both the tab
 * order and the a11y tree while collapsed. Scalar and depth-capped `note` rows
 * render plainly, with no toggle.
 */
export default function SchemaRowCells({
  row,
  depth,
  defaultExpanded,
}: SchemaRowCellsProps) {
  const panelId = useId();
  const nestedSchema =
    row.nested && row.nested.kind !== 'note' ? row.nested.schema : undefined;
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  function handleToggle() {
    setIsExpanded((expanded) => !expanded);
  }

  return (
    <>
      <tr>
        <th scope="row" className={NAME_CELL}>
          {nestedSchema ? (
            <SchemaDisclosureToggle
              name={row.name}
              panelId={panelId}
              isExpanded={isExpanded}
              onToggle={handleToggle}
            />
          ) : (
            row.name
          )}
          {row.required ? '' : '?'}:{' '}
          <span className="text-[var(--mount-subtle-text)]">
            {row.typeLabel}
          </span>
          <p className="text-[var(--mount-alt-text)] font-sans">
            {row.description ?? ''}
          </p>
        </th>
      </tr>
      {row.nested && row.nested.kind === 'note' && (
        <tr>
          <td className={DATA_CELL}>Nested object – see full schema.</td>
        </tr>
      )}
      {nestedSchema && (
        <tr id={panelId} hidden={!isExpanded}>
          <td className={`${DATA_CELL} pl-3`}>
            <div className="pl-6 border-l-1 border-[var(--mount-border)]">
              <SchemaTable schema={nestedSchema} depth={depth + 1} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
