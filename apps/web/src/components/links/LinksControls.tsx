import IconButton from '../common/IconButton';
import PrimaryButton from '../common/PrimaryButton';
import { LINK_FORM_ID } from './LinksView';
import type { LinksFilter } from '../../lib/hooks/useLinks';

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
  /** Disables the "Stumble!" button while a random fetch is in flight. */
  randomLoading: boolean;
  /** Drives the `aria-expanded` state and label of the "Add link" / "Hide form" button. */
  showLinkForm: boolean;
  /** Called when the user clicks "Remove all read". */
  onClearRead: () => void;
  /** Called when the user clicks "Stumble!". */
  onRandom: () => Promise<void>;
  /** Toggles the inline link creation form open or closed. */
  onToggleForm: () => void;
}

/**
 * The desktop action buttons shown to the right of the tab switcher in `LinksToolbar`.
 *
 * On the unread tab: "Stumble!" + "Add link / Hide form".
 * On the read tab: "Remove all read" (hidden when the list is empty).
 *
 * This component is hidden on mobile, which has its own icon-only
 * equivalents rendered inline in `LinksToolbar`.
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
          onClick={onRandom}
        >
          <i
            className="fa-brands fa-stumbleupon text-[0.7rem]"
            aria-hidden="true"
          />
          Stumble!
        </IconButton>

        <PrimaryButton
          type="button"
          hidden={filter !== 'unread'}
          onClick={onToggleForm}
          aria-expanded={showLinkForm}
          aria-controls={LINK_FORM_ID}
        >
          <i className="fa-solid fa-plus text-[0.7rem]" aria-hidden="true" />
          Add link
        </PrimaryButton>
      </div>
    </div>
  );
}
