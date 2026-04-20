import type { Link, PaginatedLinks } from '../lib/api';
import LinkForm from './LinkForm';
import LinkCard, { LinkCardSkeleton } from './LinkCard';

type LinksFilter = 'active' | 'archived';

interface LinksViewProps {
  links: Link[];
  loadingLinks: boolean;
  search: string;
  filter: LinksFilter;
  showLinkForm: boolean;
  randomLoading: boolean;
  randomError: string | null;
  page: number;
  pagination: Pick<PaginatedLinks, 'total' | 'limit'> | null;
  onSearchChange: (value: string) => void;
  onFilterChange: (filter: LinksFilter) => void;
  onToggleForm: () => void;
  onCreated: (link: Link) => void;
  onArchiveToggle: (link: Link) => void;
  onDelete: (id: string) => void;
  onRandom: () => void;
  onLoadMore: () => void;
}

export default function LinksView({
  links,
  loadingLinks,
  search,
  filter,
  showLinkForm,
  randomLoading,
  randomError,
  page,
  pagination,
  onSearchChange,
  onFilterChange,
  onToggleForm,
  onCreated,
  onArchiveToggle,
  onDelete,
  onRandom,
  onLoadMore,
}: LinksViewProps) {
  return (
    <>
      <h2 className="text-lg font-semibold">
        {filter === 'archived' ? 'Archived links' : 'Your links'}
      </h2>
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        {filter === 'archived'
          ? "Review things you've already read or decided to move aside."
          : "Add links, search, archive, and let Linklater pick something at random when you're indecisive."}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="Links filter" className="inline-flex rounded-full bg-[var(--bg-surface)] border border-[var(--border)] p-1 text-xs">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'active'}
            onClick={() => onFilterChange('active')}
            className={`px-3 py-1.5 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              filter === 'active'
                ? 'bg-[var(--text)] text-[var(--bg)] font-semibold'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] cursor-pointer'
            }`}
          >
            Your links
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'archived'}
            onClick={() => onFilterChange('archived')}
            className={`px-3 py-1.5 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              filter === 'archived'
                ? 'bg-[var(--text)] text-[var(--bg)] font-semibold'
                : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] cursor-pointer'
            }`}
          >
            Archived
          </button>
        </div>

        <button
          type="button"
          onClick={onRandom}
          disabled={randomLoading}
          className="px-4 py-2 inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] font-semibold shadow-md text-xs disabled:opacity-60 disabled:cursor-wait cursor-pointer hover:bg-[var(--bg-surface)]"
        >
          <i className="fa-solid fa-shuffle text-[0.7rem]" />
          {randomLoading ? 'Rolling…' : 'Random link'}
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          aria-label="Search your links"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search your links…"
          className="w-full sm:max-w-sm rounded-lg border border-[var(--border)] px-3 py-2 text-sm bg-[var(--bg-input)] text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/70"
        />
        <button
          type="button"
          aria-expanded={showLinkForm}
          onClick={onToggleForm}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] text-[var(--accent-fg)] font-semibold text-xs px-4 py-2 shadow-md hover:bg-[var(--accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] transition cursor-pointer"
        >
          <i className="fa-solid fa-plus text-[0.7rem]" />
          {showLinkForm ? 'Hide form' : 'Add link'}
        </button>
      </div>

      {randomError && (
        <p role="alert" className="animate-fade-in-up mt-2 text-xs text-rose-300">
          {randomError}
        </p>
      )}

      {showLinkForm && (
        <div className="animate-fade-in-up mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
          <LinkForm onCreated={onCreated} />
        </div>
      )}

      <div className="mt-6 space-y-3">
        {loadingLinks && page === 1 ? (
          Array.from({ length: 5 }).map((_, index) => (
            <LinkCardSkeleton key={index} />
          ))
        ) : links.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">
            No links yet. Click{' '}
            <span className="font-semibold">Add link</span> to save something
            for later.
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
              type="button"
              onClick={onLoadMore}
              disabled={loadingLinks}
              className="px-4 py-2 text-xs rounded-full border border-[var(--border)] bg-[var(--bg-elevated)] text-[var(--text)] hover:bg-[var(--bg-surface)] disabled:opacity-60 disabled:cursor-wait cursor-pointer"
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
