import type { Link } from '../lib/api';

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
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <a
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="text-sm font-semibold text-slate-50 hover:text-emerald-300 truncate block"
        >
          {link.title}
        </a>
        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
          <span className="truncate">{link.host}</span>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <span>Saved {created}</span>
          {archived && (
            <>
              <span className="w-1 h-1 rounded-full bg-slate-600" />
              <span className="text-amber-300">Archived {archived}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={onArchiveToggle}
          className="px-2.5 py-1.5 inline-flex items-center gap-1.5 text-xs rounded-full border border-slate-700 text-slate-200 hover:bg-slate-800 cursor-pointer"
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
          className="px-2.5 py-1.5 inline-flex items-center gap-1.5 text-xs rounded-full border border-rose-700 text-rose-200 hover:bg-rose-900/70 cursor-pointer"
        >
          <i className="fa-solid fa-trash-can text-[0.7rem]" />
          Delete
        </button>
      </div>
    </div>
  );
}
