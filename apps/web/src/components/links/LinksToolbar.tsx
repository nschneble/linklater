import { LINKS_LIST_ID } from './LinksList';
import LinksControls from './LinksControls';
import LinksMobileControls from './LinksMobileControls';
import SlidingTabBar from '../common/SlidingTabBar';
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
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-4">
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

      <div className="flex items-center gap-2 mt-3 sm:mt-4 mb-3">
        <input
          ref={searchInputReference}
          className="flex-1 min-w-0 px-3 py-2 bg-[var(--base-input-bg)] border border-[var(--base-border)] text-[var(--base-text)] text-sm placeholder:text-[var(--base-alt-text)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-[var(--focus-ring)] rounded-lg"
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
