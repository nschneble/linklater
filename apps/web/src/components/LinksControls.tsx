import IconButton from './ui/IconButton';
import PrimaryButton from './ui/PrimaryButton';
import type { LinksFilter } from '../lib/useLinks';

/**
 * Props for `LinksControls`. These are a subset of `LinksToolbarProps` —
 * `LinksToolbar` passes them down for the desktop action buttons.
 */
interface LinksControlsProps {
  /** Drives which buttons are shown (unread tab shows Add/Stumble; read shows Remove all). */
  filter: LinksFilter;
  /** Disables the "Remove all" button while deletion is in progress. */
  isClearingRead: boolean;
  /** Hides the "Remove all" button when there are no read links to delete. */
  linksCount: number;
  /** Disables and relabels the "Stumble upon" button while a random fetch is in flight. */
  randomLoading: boolean;
  /** Drives the `aria-expanded` state and label of the "Add link" / "Hide form" button. */
  showLinkForm: boolean;
  onClearRead: () => void;
  onRandom: () => Promise<void>;
  onToggleForm: () => void;
}

/**
 * The desktop action buttons shown to the right of the tab switcher in `LinksToolbar`.
 *
 * On the unread tab: "Stumble upon" + "Add link / Hide form".
 * On the read tab: "Remove all read" (hidden when the list is empty).
 *
 * This component is hidden on mobile (`hidden sm:contents` in `LinksToolbar`)
 * — mobile has its own icon-only equivalents rendered inline in `LinksToolbar`.
 */
export default function LinksControls({
  filter,
  isClearingRead,
  linksCount,
  randomLoading,
  showLinkForm,
  onClearRead,
  onRandom,
  onToggleForm,
}: LinksControlsProps) {
  return (
    <div className="flex flex-1 justify-between gap-3">
      <IconButton
        variant="elevated"
        disabled={isClearingRead}
        hidden={filter === 'unread' || linksCount === 0}
        title="Permanently removes all read links."
        onClick={onClearRead}
      >
        <i className="fa-solid fa-trash text-[0.7rem]" aria-hidden="true" />
        Remove all read
      </IconButton>

      <div className="flex gap-3">
        <IconButton
          variant="elevated"
          disabled={randomLoading}
          hidden={filter !== 'unread'}
          title="Opens a random unread link and marks it as read."
          onClick={onRandom}
        >
          <i className="fa-solid fa-shuffle text-[0.7rem]" aria-hidden="true" />
          {randomLoading ? 'Stumbling…' : 'Stumble upon'}
        </IconButton>

        <PrimaryButton
          type="button"
          hidden={filter !== 'unread'}
          onClick={onToggleForm}
          aria-expanded={showLinkForm}
        >
          <i className="fa-solid fa-plus text-[0.7rem]" aria-hidden="true" />
          {showLinkForm ? 'Hide form' : 'Add link'}
        </PrimaryButton>
      </div>
    </div>
  );
}
