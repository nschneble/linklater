import { FOCUS_RING } from '../lib/styles';

/**
 * Settings section that renders a draggable bookmark link for the
 * `/stumble` route. Dragging it to the browser bookmarks bar lets users
 * stumble upon a random unread link from anywhere with one click.
 *
 * Unlike the bookmarklet, this is a plain URL link and no auth token is
 * embedded. The user must already be logged into Linklater for the route
 * to work.
 */
export default function StumbleSection() {
  return (
    <div className="max-w-md space-y-3">
      <h3 className="text-[var(--text)] text-sm font-semibold [text-wrap:balance]">
        Stumble upon
      </h3>
      <p className="text-[var(--text-muted)] text-xs text-pretty">
        Drag this to your bookmarks bar. Click it to automatically open a random
        unread link from your collection!
      </p>
      <a
        href="/stumble"
        className={`inline-flex items-center justify-center gap-1.5 pl-3.5 pr-4 py-2 bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] border-shadow hover:border-shadow text-[var(--text)] text-xs font-semibold ring-1 ring-[var(--border)] ${FOCUS_RING} rounded-full cursor-grab active:cursor-grabbing active:scale-[0.96] transition duration-200`}
        draggable
      >
        <i
          className="fa-solid fa-shuffle text-[var(--text-subtle)] text-[0.7rem]"
          aria-hidden="true"
        />
        Stumble upon
      </a>
    </div>
  );
}
