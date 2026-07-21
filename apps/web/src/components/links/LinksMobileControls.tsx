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
 * This component is hidden on desktop (`flex sm:hidden` wrapper) – desktop has
 * the full-text equivalents in `LinksControls`.
 */
export default function LinksMobileControls({
  filter,
  isClearingRead,
  linksCount,
  pasting,
  randomLoading,
  showLinkForm,
  onClearRead,
  onPasteAndSave,
  onRandom,
  onToggleForm,
}: LinksControlsProps) {
  return (
    <div className="sm:hidden flex shrink-0 gap-2">
      {filter === 'read' && (
        <IconButton
          variant="elevated"
          surface="base"
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
            surface="base"
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
          <IconButton
            variant="elevated"
            surface="base"
            aria-label="Paste & save"
            title="Paste & save"
            aria-disabled={pasting || undefined}
            aria-busy={pasting || undefined}
            className="px-2.5! aria-disabled:opacity-60 aria-disabled:cursor-not-allowed"
            onClick={onPasteAndSave}
          >
            <i className="fa-solid fa-paste text-[0.7rem]" aria-hidden="true" />
          </IconButton>
          <PrimaryButton
            type="button"
            surface="base"
            aria-label={showLinkForm ? 'Hide form' : 'Add link'}
            aria-haspopup="dialog"
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
