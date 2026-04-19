import type { Link } from '../lib/api';

export function LinkCardSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 animate-pulse">
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-4 w-3/4 rounded bg-[var(--bg-elevated)]" />
        <div className="flex items-center gap-2">
          <div className="h-3 w-20 rounded bg-[var(--bg-elevated)]" />
          <div className="w-1 h-1 rounded-full bg-[var(--bg-elevated)]" />
          <div className="h-3 w-32 rounded bg-[var(--bg-elevated)]" />
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <div className="h-7 w-20 rounded-full bg-[var(--bg-elevated)]" />
        <div className="h-7 w-16 rounded-full bg-[var(--bg-elevated)]" />
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
  const created = new Date(link.createdAt).toLocaleString();
  const archived = link.archivedAt
    ? new Date(link.archivedAt).toLocaleString()
    : null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-[var(--text)] hover:text-[var(--accent)] truncate block"
        >
          {link.title}
        </a>
        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-1">
          <span className="truncate">{link.host}</span>
          <span className="w-1 h-1 rounded-full bg-[var(--text-subtle)]" />
          <span>Saved {created}</span>
          {archived && (
            <>
              <span className="w-1 h-1 rounded-full bg-[var(--text-subtle)]" />
              <span className="text-amber-300">Archived {archived}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onArchiveToggle}
          className="px-2.5 py-1.5 inline-flex items-center gap-1.5 text-xs rounded-full border border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-elevated)] cursor-pointer"
        >
          <i
            className={
              link.archivedAt
                ? 'fa-solid fa-box-archive text-[0.7rem]'
                : 'fa-regular fa-square-check text-[0.7rem]'
            }
          />
          {link.archivedAt ? 'Unarchive' : 'Archive'}
        </button>

        <button
          onClick={onDelete}
          className="px-2.5 py-1.5 inline-flex items-center gap-1.5 text-xs rounded-full border border-rose-700 text-rose-300 hover:bg-rose-900/40 cursor-pointer"
        >
          <i className="fa-solid fa-trash-can text-[0.7rem]" />
          Delete
        </button>
      </div>
    </div>
  );
}
