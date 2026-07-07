import { FOCUS_RING } from '../../lib/styles';

interface SchemaDisclosureToggleProps {
  name: string;
  panelId: string;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Disclosure trigger for a nested-schema row (WAI-ARIA APG). A native button so
 * Enter/Space work for free; its accessible name is the property name alone
 * (the chevron is aria-hidden). The chevron rotates off the DOM `aria-expanded`
 * state via a group variant, never a JS class ternary. Lives outside the
 * recursive `SchemaTable` so that file stays under the 100-line budget.
 */
export default function SchemaDisclosureToggle({
  name,
  panelId,
  isExpanded,
  onToggle,
}: SchemaDisclosureToggleProps) {
  return (
    <button
      type="button"
      className={`group ${FOCUS_RING} rounded cursor-pointer`}
      aria-expanded={isExpanded}
      aria-controls={panelId}
      onClick={onToggle}
    >
      {name}
      <i
        aria-hidden="true"
        className="fa-solid fa-chevron-down ml-1.5 group-aria-expanded:-rotate-180 motion-safe:transition-transform"
      />
    </button>
  );
}
