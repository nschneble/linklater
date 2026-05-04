import LinksControls from './LinksControls';
import TabButton from './ui/TabButton';
import { useRef } from 'react';
import { useTabNavigation } from '../lib/useTabNavigation';
import type { Link } from '../lib/api';
import type { LinksFilter } from '../lib/useLinks';

interface LinksToolbarProps {
  filter: LinksFilter;
  isClearingArchived: boolean;
  links: Link[];
  randomLoading: boolean;
  search: string;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  showLinkForm: boolean;
  onClearArchived: () => void;
  onNavigateRead: () => void;
  onNavigateUnread: () => void;
  onRandom: () => Promise<void>;
  onSearch: (value: string) => void;
  onToggleForm: () => void;
}

export default function LinksToolbar({
  filter,
  isClearingArchived,
  links,
  randomLoading,
  search,
  searchInputRef,
  showLinkForm,
  onClearArchived,
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
        <div
          ref={tablistRef}
          className="relative grid grid-cols-2 p-1 bg-[var(--bg-surface)] border-shadow hover:border-shadow text-xs rounded-full"
          role="tablist"
          aria-label="Links filter"
        >
          <div
            aria-hidden="true"
            className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-[var(--text)] rounded-full"
            style={{
              transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform:
                filter === 'archived' ? 'translateX(100%)' : 'translateX(0)',
            }}
          />
          <TabButton
            className="px-3 py-1.5"
            isActive={filter === 'active'}
            onClick={onNavigateUnread}
          >
            Unread
          </TabButton>
          <TabButton
            className="px-3 py-1.5"
            isActive={filter === 'archived'}
            onClick={onNavigateRead}
          >
            Read
          </TabButton>
        </div>

        <LinksControls
          filter={filter}
          isClearingArchived={isClearingArchived}
          linksCount={links.length}
          randomLoading={randomLoading}
          showLinkForm={showLinkForm}
          onClearArchived={onClearArchived}
          onRandom={onRandom}
          onToggleForm={onToggleForm}
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 mb-3">
        <input
          ref={searchInputRef}
          className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring focus:ring-[var(--accent)] focus:border-[var(--accent)] rounded-lg"
          type="search"
          placeholder={
            filter === 'active' ? 'Search unread links' : 'Search read links'
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
      </div>
    </>
  );
}
