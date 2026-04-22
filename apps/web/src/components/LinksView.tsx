import IconButton from './ui/IconButton';
import LinkCard, { LinkCardSkeleton } from './LinkCard';
import LinkForm from './LinkForm';
import PrimaryButton from './ui/PrimaryButton';
import TabButton from './ui/TabButton';
import type { Link, PaginatedLinks } from '../lib/api';

type LinksFilter = 'active' | 'archived';

interface LinksViewProps {
  filter: LinksFilter;
  initialLoad: boolean;
  links: Link[];
  loadingLinks: boolean;
  page: number;
  pagination: Pick<PaginatedLinks, 'total' | 'limit'> | null;
  randomError: string | null;
  randomLoading: boolean;
  search: string;
  showLinkForm: boolean;
  onArchiveToggle: (link: Link) => void;
  onCreated: (link: Link) => void;
  onDelete: (id: string) => void;
  onFilterChange: (filter: LinksFilter) => void;
  onLoadMore: () => void;
  onRandom: () => void;
  onSearchChange: (value: string) => void;
  onToggleForm: () => void;
}

export default function LinksView({
  filter,
  initialLoad,
  links,
  loadingLinks,
  page,
  pagination,
  randomError,
  randomLoading,
  search,
  showLinkForm,
  onArchiveToggle,
  onCreated,
  onDelete,
  onFilterChange,
  onLoadMore,
  onRandom,
  onSearchChange,
  onToggleForm,
}: LinksViewProps) {
  return (
    <>
      <h2 className="text-lg font-semibold">
        {filter === 'archived' ? 'Archived links' : 'Your links'}
      </h2>
      <p className="mt-1 text-[var(--text-muted)] text-xs">
        {filter === 'archived'
          ? "Review you've already read or decided to move aside."
          : 'Add links, search, archive, or stumble upon something random.'}
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
        <div
          className="inline-flex p-1 bg-[var(--bg-surface)] border border-[var(--border)] text-xs rounded-full"
          role="tablist"
          aria-label="Links filter"
        >
          <TabButton
            className="px-3 py-1.5"
            isActive={filter === 'active'}
            onClick={() => onFilterChange('active')}
          >
            Your links
          </TabButton>
          <TabButton
            className="px-3 py-1.5"
            isActive={filter === 'archived'}
            onClick={() => onFilterChange('archived')}
          >
            Archived
          </TabButton>
        </div>

        <IconButton
          variant="elevated"
          disabled={randomLoading}
          onClick={onRandom}
        >
          <i className="fa-solid fa-shuffle text-[0.7rem]" />
          {randomLoading ? 'Stumbling…' : 'Stumble upon'}
        </IconButton>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
        <input
          className="w-full sm:max-w-sm px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded-lg"
          type="search"
          placeholder="Search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          aria-label="Search through your links"
        />
        <PrimaryButton
          className="gap-1.5 text-xs rounded-full cursor-pointer"
          type="button"
          onClick={onToggleForm}
          aria-expanded={showLinkForm}
        >
          <i className="fa-solid fa-plus text-[0.7rem]" />
          {showLinkForm ? 'Hide form' : 'Add link'}
        </PrimaryButton>
      </div>

      {randomError && (
        <p
          className="mt-2 text-rose-300 text-xs animate-fade-in-up"
          role="alert"
        >
          {randomError}
        </p>
      )}

      {showLinkForm && (
        <div className="mt-4 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl animate-fade-in-up">
          <LinkForm onCreated={onCreated} />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {loadingLinks && page === 1 && initialLoad ? (
          Array.from({ length: 5 }).map((_, index) => (
            <LinkCardSkeleton key={index} />
          ))
        ) : links.length === 0 ? (
          <p className="text-[var(--text-muted)] text-sm">
            No links yet. Click <span className="font-semibold">Add link</span>{' '}
            to save something to read later.
          </p>
        ) : (
          links.map((link) => (
            <LinkCard
              key={link.id}
              link={link}
              onArchiveToggle={() => onArchiveToggle(link)}
              onDelete={() => onDelete(link.id)}
            />
          ))
        )}

        {pagination && links.length < pagination.total && (
          <div className="flex justify-center pt-2">
            <button
              className="px-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text)] text-xs rounded-full cursor-pointer disabled:cursor-wait disabled:opacity-60"
              type="button"
              disabled={loadingLinks}
              onClick={onLoadMore}
            >
              {loadingLinks
                ? 'Loading…'
                : `Load more (${pagination.total - links.length} remaining)`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
