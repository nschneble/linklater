/**
 * The static saved-link card in the app mock (mount surface). Decorative only:
 * favicon and thumbnail are CSS-painted <div>/<span> shapes (no <img>), the
 * "Add a note" field is a styled <div> (never an <input>), and there are no
 * focusable descendants. Paints every mount slot — including the left accent
 * border (mount-highlight) and a fake field (mount-input-bg).
 */
export default function MockLinkCard() {
  return (
    <div className="p-3 bg-[var(--mount-bg)] border border-l-4 border-[var(--mount-border)] border-l-[var(--mount-highlight)] rounded-xl">
      <div className="flex items-start gap-2.5">
        <span className="flex shrink-0 w-5 h-5 bg-[var(--mount-highlight-hover)] rounded-full" />
        <div className="flex-1 min-w-0">
          <p className="text-[var(--mount-text)] text-[0.78rem] font-semibold truncate">
            Designing for the next billion users
          </p>
          <p className="text-[var(--mount-alt-text)] text-[0.65rem] truncate">
            smashingmagazine.com
          </p>
        </div>
        <span className="px-1.5 py-0.5 bg-[var(--mount-highlight)] text-[var(--mount-highlight-fg)] text-[0.55rem] font-semibold rounded">
          Design
        </span>
      </div>

      <div className="w-full h-14 mt-2.5 bg-gradient-to-br from-[var(--mount-highlight)] to-[var(--mount-highlight-hover)] rounded-lg" />

      <p className="mt-2 text-[var(--mount-alt-text)] text-[0.65rem] line-clamp-2">
        A practical look at building resilient, low-bandwidth interfaces that
        stay fast and legible on modest hardware and flaky connections.
      </p>

      <div className="flex items-center gap-2 mt-2.5 px-2 py-1 bg-[var(--mount-input-bg)] border border-[var(--mount-border)] rounded-md">
        <i
          className="fa-solid fa-pen text-[var(--mount-alt-text)] text-[0.55rem]"
          aria-hidden="true"
        />
        <span className="text-[var(--mount-alt-text)] text-[0.65rem]">
          Add a note…
        </span>
      </div>
    </div>
  );
}
