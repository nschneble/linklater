import type { Link } from '../lib/api';
import IconButton from './ui/IconButton';

export function LinkCardSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl animate-pulse">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="w-3/4 h-4 bg-[var(--bg-elevated)] rounded" />
        <div className="flex items-center gap-2">
          <div className="w-20 h-3 bg-[var(--bg-elevated)] rounded" />
          <div className="w-1 h-1 bg-[var(--bg-elevated)] rounded-full" />
          <div className="w-32 h-3 bg-[var(--bg-elevated)] rounded" />
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <div className="w-20 h-7 bg-[var(--bg-elevated)] rounded-full" />
        <div className="w-16 h-7 bg-[var(--bg-elevated)] rounded-full" />
      </div>
    </div>
  );
}

interface LinkCardProps {
  link: Link;
  onArchiveToggle: () => void;
  onDelete: () => void;
}

export default function LinkCard({
  link,
  onArchiveToggle,
  onDelete,
}: LinkCardProps) {
  const archived = link.archivedAt
    ? new Date(link.archivedAt).toLocaleString()
    : null;
  const created = new Date(link.createdAt).toLocaleString();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl animate-fade-in-up">
      <div className="flex-1 min-w-0">
        <a
          className="block text-[var(--text)] hover:text-[var(--accent)] text-sm font-semibold truncate"
          href={link.url}
          rel="noreferrer"
          target="_blank"
        >
          {link.title}
        </a>

        <div className="flex items-center gap-2 mt-1 text-[var(--text-muted)] text-xs">
          <span className="truncate">{link.host}</span>
          <span className="w-1 h-1 bg-[var(--text-subtle)] rounded-full" />
          <span>Saved {created}</span>
          {archived && (
            <>
              <span className="w-1 h-1 bg-[var(--text-subtle)] rounded-full" />
              <span className="text-amber-300">Archived {archived}</span>
            </>
          )}
          {!link.metaFetchedAt && (
            <span
              title="Fetching info…"
              className="inline-block w-1.5 h-1.5 bg-[var(--accent)] rounded-full animate-pulse"
            />
          )}
        </div>

        {link.metaFetchedAt && (link.metaImage || link.metaDescription) && (
          <div className="flex items-start gap-3 mt-2">
            {link.metaImage && (
              <img
                className="shrink-0 w-16 h-12 bg-[var(--bg-elevated)] object-cover rounded-md"
                src={link.metaImage}
                alt={link.title}
                onError={(error) => {
                  (error.target as HTMLImageElement).style.display = 'none';
                }}
                aria-hidden="true"
              />
            )}
            {link.metaDescription && (
              <p className="text-[var(--text-muted)] text-xs line-clamp-2">
                {link.metaDescription}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 justify-end">
        <IconButton
          onClick={onArchiveToggle}
          aria-label={
            link.archivedAt
              ? `Unarchive "${link.title}"`
              : `Archive "${link.title}"`
          }
        >
          <i
            className={
              link.archivedAt
                ? 'fa-solid fa-box-archive text-[0.7rem]'
                : 'fa-regular fa-square-check text-[0.7rem]'
            }
          />
          {link.archivedAt ? 'Unarchive' : 'Archive'}
        </IconButton>

        <IconButton
          variant="danger"
          onClick={onDelete}
          aria-label={`Delete "${link.title}"`}
        >
          <i className="fa-solid fa-trash-can text-[0.7rem]" />
          Delete
        </IconButton>
      </div>
    </div>
  );
}
