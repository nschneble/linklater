/**
 * The static top nav bar in the app mock. Rendering surface is orbit (matches
 * the real header). Decorative only: the logo, wordmark, and avatar are plain
 * <span>/<div> shapes — no <button>, no <a href>, no focusable descendants.
 */
export default function MockHeader() {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-[var(--orbit-bg)] border-b border-[var(--orbit-border)]">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-6 h-6 bg-[var(--orbit-highlight)] rounded-md">
          <i
            className="fa-solid fa-link text-[var(--orbit-highlight-fg)] text-[0.6rem]"
            aria-hidden="true"
          />
        </span>
        <span className="text-[var(--orbit-text)] text-sm font-bold">
          Linklater
        </span>
        <span className="ml-1 text-[var(--orbit-alt-text)] text-[0.65rem]">
          Your links
        </span>
      </div>
      <span className="flex items-center justify-center w-6 h-6 bg-[var(--orbit-highlight-hover)] rounded-full">
        <span className="text-[var(--orbit-highlight-fg)] text-[0.6rem] font-bold">
          N
        </span>
      </span>
    </div>
  );
}
