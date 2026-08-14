import { FOCUS_RING } from '../../lib/styles';
import IconButton from '../common/IconButton';
import { LINKS_LIST_ID } from './LinksList';
import LinksControls from './LinksControls';
import LinksMobileControls from './LinksMobileControls';
import SlidingTabBar from '../common/SlidingTabBar';
import { useLayoutEffect, useRef } from 'react';
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
  /** Passed to `LinksControls` to disable the "Stumble!" button. */
  randomLoading: boolean;
  /** The controlled value of the search input. */
  search: string;
  /** Ref forwarded to the search input so `LinksView` can imperatively focus it on shortcut press. */
  searchInputReference: React.RefObject<HTMLInputElement | null>;
  /** Whether the inline link form is open – drives button label and `aria-expanded`. */
  showLinkForm: boolean;
  /** Called when the user clicks "Remove all read". */
  onClearRead: () => void;
  /** Navigates to the `/read` route when the Read tab is clicked. */
  onNavigateRead: () => void;
  /** Navigates to the `/unread` route when the Unread tab is clicked. */
  onNavigateUnread: () => void;
  /** Called when the user clicks "Stumble!" */
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
  searchInputReference,
  showLinkForm,
  onClearRead,
  onNavigateRead,
  onNavigateUnread,
  onRandom,
  onSearch,
  onToggleForm,
}: LinksToolbarProps) {
  // clear button unmounts on search reset; track focus to refocus the input
  const clearButtonWasFocusedReference = useRef(false);

  // useLayoutEffect (not useEffect) so focus recovery commits before paint
  useLayoutEffect(() => {
    if (search === '' && clearButtonWasFocusedReference.current) {
      clearButtonWasFocusedReference.current = false;
      searchInputReference.current?.focus();
    }
  }, [search, searchInputReference]);

  // inert while the save-link dialog traps focus, per WCAG 2.4.3
  const inert = showLinkForm ? true : undefined;

  return (
    <>
      <div
        className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4"
        inert={inert}
      >
        <SlidingTabBar
          ariaLabel="Links filter"
          activeIndex={filter === 'read' ? 1 : 0}
          className="shrink-0 border-shadow hover:border-shadow text-xs"
          tabClassName="px-3 py-1.5"
          tabs={[
            {
              id: 'tab-unread',
              ariaControls: LINKS_LIST_ID,
              label: 'Unread',
              onClick: onNavigateUnread,
            },
            {
              id: 'tab-read',
              ariaControls: LINKS_LIST_ID,
              label: 'Read',
              onClick: onNavigateRead,
            },
          ]}
        />

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

      <div className="flex items-center gap-2 mt-3 sm:mt-4 mb-3" inert={inert}>
        <div className="relative flex-1 min-w-0">
          <input
            ref={searchInputReference}
            className={`w-full min-w-0 pl-3 pr-10 py-2 bg-[var(--base-input-bg)] border border-[var(--base-border)] text-[var(--base-text)] text-base sm:text-sm placeholder:text-[var(--base-alt-text)] ${FOCUS_RING} rounded-lg [&::-webkit-search-cancel-button]:appearance-none`}
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
          />

          {search !== '' && (
            <IconButton
              variant="ghost"
              surface="base"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 py-2!"
              aria-label="Clear search"
              onClick={() => {
                onSearch('');
                searchInputReference.current?.focus();
              }}
              onFocus={() => {
                clearButtonWasFocusedReference.current = true;
              }}
              onBlur={() => {
                clearButtonWasFocusedReference.current = false;
              }}
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </IconButton>
          )}
        </div>

        <LinksMobileControls
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
    </>
  );
}
