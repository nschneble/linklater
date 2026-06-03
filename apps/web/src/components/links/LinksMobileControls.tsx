import IconButton from '../common/IconButton';
import PrimaryButton from '../common/PrimaryButton';
import { LINK_FORM_ID } from './constants';
import type { LinksControlsProps } from './links-controls-props';

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
}: LinksControlsProps) {
  return (
    <div className="sm:hidden flex shrink-0 gap-2">
      {filter === 'read' && (
        <IconButton
          variant="elevated"
          disabled={isClearingRead || linksCount === 0}
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
