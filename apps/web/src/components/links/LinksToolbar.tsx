import LinksControls from './LinksControls';
import IconButton from '../common/IconButton';
import { LINKS_LIST_ID } from './LinksList';
import { LINK_FORM_ID } from './LinksView';
import PrimaryButton from '../common/PrimaryButton';
import TabButton from '../common/TabButton';
import { useRef } from 'react';
import { useTabNavigation } from '../../lib/hooks/useTabNavigation';
import type { Link } from '../../lib/api';
import type { LinksFilter } from '../../lib/hooks/useLinks';

/** Props for `LinksToolbar`. All values come from `LinksView`. */
interface LinksToolbarProps {
  /** The current filter, driving which tab is highlighted and which controls are shown. */
  filter: LinksFilter;
  /** Disables the "Remove all" button while the delete request is in progress. */
  isClearingRead: boolean;
  /** Passed to `LinksControls` to conditionally hide the "Remove all" button. */
  links: Link[];
  /** Passed to `LinksControls` to disable/relabel the "Stumble upon" button. */
  randomLoading: boolean;
  /** The controlled value of the search input. */
  search: string;
  /** Ref forwarded to the search input so `LinksView` can imperatively focus it on shortcut press. */
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  /** Whether the inline link form is open — drives button label and `aria-expanded`. */
  showLinkForm: boolean;
  /** Called when the user clicks "Remove all read". */
  onClearRead: () => void;
  /** Navigates to the `/read` route when the Read tab is clicked. */
  onNavigateRead: () => void;
  /** Navigates to the `/unread` route when the Unread tab is clicked. */
  onNavigateUnread: () => void;
  /** Called when the user clicks "Stumble upon". */
  onRandom: () => Promise<void>;
  /** Called with the new search string on every keystroke. */
  onSearch: (value: string) => void;
  /** Toggles the inline link creation form open or closed. */
  onToggleForm: () => void;
}

/**
 * The full toolbar above the links list. Contains:
 * - An Unread/Read tab switcher (accessible with arrow keys via `useTabNavigation`).
 * - Desktop action buttons via `LinksControls` (hidden on mobile).
 * - A search input with Escape-to-blur behavior.
 * - Mobile icon-only equivalents of the action buttons.
 *
 * The tab switcher uses a CSS-animated sliding pill indicator (`translateX`)
 * rather than conditional class changes so that the transition is smooth.
 */
export default function LinksToolbar({
  filter,
  isClearingRead,
  links,
  randomLoading,
  search,
  searchInputRef,
  showLinkForm,
  onClearRead,
  onNavigateRead,
  onNavigateUnread,
  onRandom,
  onSearch,
  onToggleForm,
}: LinksToolbarProps) {
  const tablistRef = useRef<HTMLDivElement>(null);
  useTabNavigation(tablistRef);

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
        <div
          ref={tablistRef}
          className="relative grid grid-cols-2 shrink-0 p-1 bg-[var(--bg-surface)] border-shadow hover:border-shadow text-xs rounded-full"
          role="tablist"
          aria-label="Links filter"
        >
          <div
            aria-hidden="true"
            className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-[var(--text)] rounded-full"
            style={{
              transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform:
                filter === 'read' ? 'translateX(100%)' : 'translateX(0)',
            }}
          />
          <TabButton
            className="px-3 py-1.5"
            isActive={filter === 'unread'}
            onClick={onNavigateUnread}
          >
            Unread
          </TabButton>
          <TabButton
            className="px-3 py-1.5"
            isActive={filter === 'read'}
            onClick={onNavigateRead}
          >
            Read
          </TabButton>
        </div>

        <div className="hidden sm:contents">
          <LinksControls
            filter={filter}
            isClearingRead={isClearingRead}
            linksCount={links.length}
            randomLoading={randomLoading}
            showLinkForm={showLinkForm}
            onClearRead={onClearRead}
            onRandom={onRandom}
            onToggleForm={onToggleForm}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 sm:mt-4 mb-3">
        <input
          ref={searchInputRef}
          className="flex-1 min-w-0 px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring focus:ring-[var(--accent)] focus:border-[var(--accent)] rounded-lg"
          type="search"
          placeholder={
            filter === 'unread' ? 'Search unread links' : 'Search read links'
          }
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.blur();
            }
          }}
          aria-label="Search through your links"
          aria-controls={LINKS_LIST_ID}
        />

        <div className="flex sm:hidden shrink-0 gap-2">
          {filter === 'read' && links.length > 0 && (
            <IconButton
              variant="elevated"
              disabled={isClearingRead}
              aria-label="Remove all read links"
              title="Permanently removes all read links."
              className="!px-2.5"
              onClick={onClearRead}
            >
              <i
                className="fa-solid fa-trash text-[0.7rem]"
                aria-hidden="true"
              />
            </IconButton>
          )}
          {filter === 'unread' && (
            <>
              <IconButton
                variant="elevated"
                disabled={randomLoading}
                aria-label={
                  randomLoading ? 'Stumbling…' : 'Stumble upon a random link'
                }
                title="Opens a random unread link and marks it as read."
                className="!px-2.5"
                onClick={onRandom}
              >
                <i
                  className="fa-solid fa-shuffle text-[0.7rem]"
                  aria-hidden="true"
                />
              </IconButton>
              <PrimaryButton
                type="button"
                aria-label={showLinkForm ? 'Hide form' : 'Add link'}
                aria-expanded={showLinkForm}
                aria-controls={LINK_FORM_ID}
                className="!px-2.5"
                onClick={onToggleForm}
              >
                <i
                  className="fa-solid fa-plus text-[0.7rem]"
                  aria-hidden="true"
                />
              </PrimaryButton>
            </>
          )}
        </div>
      </div>
    </>
  );
}
