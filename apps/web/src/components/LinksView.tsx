import IconButton from './ui/IconButton';
import KeyboardShortcutsModal from './KeyboardShortcutsModal';
import LinkCard, { LinkCardSkeleton } from './LinkCard';
import LinkForm from './LinkForm';
import PrimaryButton from './ui/PrimaryButton';
import TabButton from './ui/TabButton';
import { createPortal } from 'react-dom';
import { type RefObject, useEffect, useState } from 'react';
import type { Link, PaginatedLinks } from '../lib/api';

type LinksFilter = 'active' | 'archived';

interface LinksViewProps {
  filter: LinksFilter;
  links: Link[];
  loadingLinks: boolean;
  page: number;
  pagination: Pick<PaginatedLinks, 'total' | 'limit'> | null;
  randomError: string | null;
  randomLoading: boolean;
  saveError: string | null;
  search: string;
  showLinkForm: boolean;
  showShortcuts: boolean;
  onArchiveToggle: (link: Link) => void;
  onCreated: (link: Link) => void;
  onDeleteAllArchived: () => Promise<void>;
  onFilterChange: (filter: LinksFilter) => void;
  onLoadMore: () => void;
  onRandom: () => void;
  onSearchChange: (value: string) => void;
  searchInputRef: RefObject<HTMLInputElement>;
  onToggleShortcuts: () => void;
  onToggleForm: () => void;
}

export default function LinksView({
  filter,
  links,
  loadingLinks,
  page,
  pagination,
  randomError,
  randomLoading,
  saveError,
  search,
  showLinkForm,
  showShortcuts,
  onArchiveToggle,
  onCreated,
  onDeleteAllArchived,
  onFilterChange,
  onLoadMore,
  onRandom,
  onSearchChange,
  searchInputRef,
  onToggleShortcuts,
  onToggleForm,
}: LinksViewProps) {
  const [isClearingArchived, setIsClearingArchived] = useState(false);

  useEffect(() => {
    setIsClearingArchived(false);
  }, [filter]);

  useEffect(() => {
    if (!showLinkForm) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onToggleForm();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showLinkForm, onToggleForm]);

  async function handleClearArchived() {
    setIsClearingArchived(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 400));
    try {
      await onDeleteAllArchived();
    } finally {
      setIsClearingArchived(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold">Your links</h2>
        <button
          type="button"
          className="text-[var(--text-subtle)] hover:text-[var(--text)] transition-colors cursor-pointer"
          onClick={onToggleShortcuts}
          aria-label="Show keyboard shortcuts"
          title="Keyboard shortcuts"
        >
          <i className="fa-regular fa-keyboard text-sm" aria-hidden="true" />
        </button>
      </div>
      <p className="text-[var(--text-muted)] text-xs">
        {filter === 'archived'
          ? 'Read links are automatically removed after 7 days.'
          : 'Add, search, or stumble upon something random.'}
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
        <div
          className="relative grid grid-cols-2 p-1 bg-[var(--bg-surface)] border-shadow-[var(--bg-surface)] border-shadow-md hover:border-shadow-md text-xs rounded-full"
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
            onClick={() => onFilterChange('active')}
          >
            Unread
          </TabButton>
          <TabButton
            className="px-3 py-1.5"
            isActive={filter === 'archived'}
            onClick={() => onFilterChange('archived')}
          >
            Read
          </TabButton>
        </div>

        {filter === 'active' && (
          <div className="flex items-end gap-3">
            <IconButton
              variant="elevated"
              disabled={randomLoading}
              title="Opens a random unread link and marks it as read."
              onClick={onRandom}
            >
              <i
                className="fa-solid fa-shuffle text-[0.7rem]"
                aria-hidden="true"
              />
              {randomLoading ? 'Stumbling…' : 'Stumble upon'}
            </IconButton>

            <PrimaryButton
              type="button"
              onClick={onToggleForm}
              aria-expanded={showLinkForm}
            >
              <i
                className="fa-solid fa-plus text-[0.7rem]"
                aria-hidden="true"
              />
              {showLinkForm ? 'Hide form' : 'Add link'}
            </PrimaryButton>
          </div>
        )}

        {filter === 'archived' && links.length > 0 && (
          <div className="flex items-end gap-3">
            <IconButton
              variant="elevated"
              disabled={isClearingArchived}
              title="Permanently removes all read links."
              onClick={handleClearArchived}
            >
              <i
                className="fa-solid fa-trash text-[0.7rem]"
                aria-hidden="true"
              />
              Remove all read
            </IconButton>
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 mb-3">
        <input
          ref={searchInputRef}
          className="w-full px-3 py-2 bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text)] text-sm placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] rounded-lg"
          type="search"
          placeholder={
            filter === 'active' ? 'Search unread links' : 'Search read links'
          }
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.currentTarget.blur();
            }
          }}
          aria-label="Search through your links"
        />
      </div>

      {randomError && (
        <p
          className="mt-2 text-rose-300 text-xs animate-fade-in-up"
          role="alert"
        >
          {randomError}
        </p>
      )}

      {saveError && (
        <p
          className="mt-2 text-rose-300 text-xs animate-fade-in-up"
          role="alert"
        >
          {saveError}
        </p>
      )}

      {showShortcuts && <KeyboardShortcutsModal onClose={onToggleShortcuts} />}

      {showLinkForm &&
        createPortal(
          <div
            className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm"
            onClick={onToggleForm}
          />,
          document.body,
        )}

      {showLinkForm && (
        <div className="relative z-30 mt-0 animate-fade-in-up">
          <LinkForm onCreated={onCreated} />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6">
        {loadingLinks && page === 1 ? (
          Array.from({ length: 1 }).map((_, index) => (
            <LinkCardSkeleton key={index} />
          ))
        ) : links.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-9 text-center animate-fade-in-up">
            <i
              className={`text-4xl text-[var(--text-subtle)] mb-[7px] fa-regular ${
                search !== ''
                  ? 'fa-magnifying-glass'
                  : filter === 'archived'
                    ? 'fa-circle-check'
                    : 'fa-bookmark'
              }`}
              aria-hidden="true"
            />
            <p className="text-[var(--text-muted)] text-sm font-medium">
              {filter === 'archived' ? 'No read links' : 'No unread links'}
            </p>
          </div>
        ) : (
          links.map((link, index) => (
            <div
              key={link.id}
              className={
                isClearingArchived
                  ? 'animate-card-exit pointer-events-none'
                  : ''
              }
              style={
                isClearingArchived
                  ? { animationDelay: `${index * 40}ms` }
                  : undefined
              }
            >
              <LinkCard
                link={link}
                animationDelay={Math.min(index * 60, 240)}
                onArchiveToggle={() => onArchiveToggle(link)}
              />
            </div>
          ))
        )}

        {pagination && links.length < pagination.total && (
          <div className="flex justify-center pt-2">
            <button
              className="px-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] text-[var(--text)] text-xs rounded-full shadow-sm disabled:opacity-60 cursor-pointer disabled:cursor-wait"
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
