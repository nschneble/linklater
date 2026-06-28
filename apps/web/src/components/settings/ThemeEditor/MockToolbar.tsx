/**
 * The static page toolbar in the app mock (base surface): page title, a fake
 * search field, the Add link / Stumble actions, and the Unread / Read tab
 * pills. Decorative only — the "search field" is a styled <div> (never an
 * <input>), the actions and pills are <span>s with no handlers and no focusable
 * descendants. Renders BOTH a static selected pill (Unread) and an unselected
 * pill (Read) so both tab styles can be checked at once.
 */
export default function MockToolbar() {
  return (
    <div className="space-y-2.5 px-4 pt-3">
      <span className="block text-[var(--base-text)] text-base font-bold">
        Your links
      </span>

      <div className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 px-2.5 py-1.5 bg-[var(--base-input-bg)] border border-[var(--base-border)] rounded-md">
          <i
            className="fa-solid fa-magnifying-glass text-[var(--base-subtle-text)] text-[0.65rem]"
            aria-hidden="true"
          />
          <span className="flex-1 text-[var(--base-alt-text)] text-[0.7rem]">
            Search links…
          </span>
          <span className="px-1 text-[var(--base-subtle-text)] text-[0.6rem]">
            /
          </span>
        </div>
        <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--base-highlight)] text-[var(--base-highlight-fg)] text-[0.7rem] font-semibold rounded-md">
          <i className="fa-solid fa-plus text-[0.6rem]" aria-hidden="true" />
          Add link
        </span>
        <span className="flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--base-highlight-hover)] text-[var(--base-highlight-fg)] text-[0.7rem] font-semibold rounded-md">
          <i
            className="fa-brands fa-stumbleupon text-[0.6rem]"
            aria-hidden="true"
          />
          Stumble!
        </span>
      </div>

      <div className="flex w-fit gap-1 p-1 bg-[var(--base-input-bg)] border border-[var(--base-border)] rounded-full">
        <span className="flex items-center gap-1 px-3 py-1 bg-[var(--base-highlight)] text-[var(--base-highlight-fg)] text-[0.65rem] font-semibold rounded-full">
          <i
            className="fa-solid fa-circle-dot text-[0.4rem]"
            aria-hidden="true"
          />
          Unread
        </span>
        <span className="px-3 py-1 text-[var(--base-alt-text)] text-[0.65rem] font-semibold rounded-full">
          Read
        </span>
      </div>
    </div>
  );
}
