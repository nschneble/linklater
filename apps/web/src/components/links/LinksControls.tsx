import IconButton from '../common/IconButton';
import { LINK_FORM_ID } from './constants';
import PrimaryButton from '../common/PrimaryButton';
import type { LinksControlsProps } from './links-controls-props';

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
        surface="base"
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
          surface="base"
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
          surface="base"
          hidden={filter !== 'unread'}
          onClick={onToggleForm}
          aria-label={showLinkForm ? 'Hide form' : 'Add link'}
          aria-haspopup="dialog"
          aria-controls={LINK_FORM_ID}
        >
          <i className="fa-solid fa-plus text-[0.7rem]" aria-hidden="true" />
          Add link
        </PrimaryButton>
      </div>
    </div>
  );
}
