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
  if (filter === 'active') {
    return (
      <div className="flex items-end gap-3">
        <IconButton
          variant="elevated"
          disabled={randomLoading}
          title="Opens a random unread link and marks it as read."
          onClick={onRandom}
        >
          <i className="fa-solid fa-shuffle text-[0.7rem]" aria-hidden="true" />
          {randomLoading ? 'Stumbling…' : 'Stumble upon'}
        </IconButton>

        <PrimaryButton
          type="button"
          onClick={onToggleForm}
          aria-expanded={showLinkForm}
        >
          <i className="fa-solid fa-plus text-[0.7rem]" aria-hidden="true" />
          {showLinkForm ? 'Hide form' : 'Add link'}
        </PrimaryButton>
      </div>
    );
  }

  if (linksCount > 0) {
    return (
      <div className="flex items-end gap-3">
        <IconButton
          variant="elevated"
          disabled={isClearingArchived}
          title="Permanently removes all read links."
          onClick={onClearArchived}
        >
          <i className="fa-solid fa-trash text-[0.7rem]" aria-hidden="true" />
          Remove all read
        </IconButton>
      </div>
    );
  }

  return null;
}
