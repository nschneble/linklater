import IconButton from './ui/IconButton';
import PrimaryButton from './ui/PrimaryButton';
import type { LinksFilter } from '../lib/useLinks';

interface LinksControlsProps {
  filter: LinksFilter;
  isClearingArchived: boolean;
  linksCount: number;
  randomLoading: boolean;
  showLinkForm: boolean;
  onClearArchived: () => void;
  onRandom: () => Promise<void>;
  onToggleForm: () => void;
}

export default function LinksControls({
  filter,
  isClearingArchived,
  linksCount,
  randomLoading,
  showLinkForm,
  onClearArchived,
  onRandom,
  onToggleForm,
}: LinksControlsProps) {
  return (
    <div className="flex items-end gap-3">
      <IconButton
        variant="elevated"
        disabled={isClearingArchived}
        hidden={filter === 'active' || linksCount == 0}
        title="Permanently removes all read links."
        onClick={onClearArchived}
      >
        <i className="fa-solid fa-trash text-[0.7rem]" aria-hidden="true" />
        Remove all read
      </IconButton>
      <IconButton
        variant="elevated"
        disabled={randomLoading}
        hidden={filter !== 'active'}
        title="Opens a random unread link and marks it as read."
        onClick={onRandom}
      >
        <i className="fa-solid fa-shuffle text-[0.7rem]" aria-hidden="true" />
        {randomLoading ? 'Stumbling…' : 'Stumble upon'}
      </IconButton>

      <PrimaryButton
        type="button"
        hidden={filter !== 'active'}
        onClick={onToggleForm}
        aria-expanded={showLinkForm}
      >
        <i className="fa-solid fa-plus text-[0.7rem]" aria-hidden="true" />
        {showLinkForm ? 'Hide form' : 'Add link'}
      </PrimaryButton>
    </div>
  );
}
