import { LINK_FORM_ID } from './LinksView';
import IconButton from '../common/IconButton';
import PrimaryButton from '../common/PrimaryButton';
import type { LinksFilter } from '../../lib/hooks/useLinks';

interface LinksMobileControlsProps {
  /** Drives which buttons are shown (unread tab shows Stumble/Add; read shows Remove all). */
  filter: LinksFilter;
  /** Disables the trash button while deletion is in progress. */
  isClearingRead: boolean;
  /** Hides the trash button when there are no read links to delete. */
  linksCount: number;
  /** Disables the shuffle button while a random fetch is in flight. */
  randomLoading: boolean;
  /** Drives the `aria-expanded` state and `aria-label` of the toggle button. */
  showLinkForm: boolean;
  /** Called when the user taps the trash icon. */
  onClearRead: () => void;
  /** Called when the user taps the shuffle icon. */
  onRandom: () => Promise<void>;
  /** Toggles the inline link creation form open or closed. */
  onToggleForm: () => void;
}

/**
 * The icon-only action buttons shown on mobile, to the right of the search input.
 *
 * On the unread tab: shuffle + add/hide-form.
 * On the read tab: trash (hidden when the list is empty).
 *
 * This component is hidden on desktop (`flex sm:hidden` wrapper) — desktop has
 * the full-text equivalents in `LinksControls`.
 */
export default function LinksMobileControls({
  filter,
  isClearingRead,
  linksCount,
  randomLoading,
  showLinkForm,
  onClearRead,
  onRandom,
  onToggleForm,
}: LinksMobileControlsProps) {
  return (
    <div className="sm:hidden flex shrink-0 gap-2">
      {filter === 'read' && linksCount > 0 && (
        <IconButton
          variant="elevated"
          disabled={isClearingRead}
          aria-label="Remove all read links"
          title="Permanently remove all read links"
          className="px-2.5!"
          onClick={onClearRead}
        >
          <i className="fa-solid fa-trash text-[0.7rem]" aria-hidden="true" />
        </IconButton>
      )}
      {filter === 'unread' && (
        <>
          <IconButton
            variant="elevated"
            disabled={randomLoading}
            aria-label="Stumble!"
            title="Open a random unread link and marks it as read"
            className="px-2.5!"
            onClick={onRandom}
          >
            <i
              className="fa-brands fa-stumbleupon text-[0.7rem]"
              aria-hidden="true"
            />
          </IconButton>
          <PrimaryButton
            type="button"
            aria-label={showLinkForm ? 'Hide form' : 'Add link'}
            aria-expanded={showLinkForm}
            aria-controls={LINK_FORM_ID}
            className="px-2.5!"
            onClick={onToggleForm}
          >
            <i className="fa-solid fa-plus text-[0.7rem]" aria-hidden="true" />
          </PrimaryButton>
        </>
      )}
    </div>
  );
}
