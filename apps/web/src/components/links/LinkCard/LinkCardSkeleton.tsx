/**
 * Animated placeholder shown while the first page of links is loading.
 *
 * Renders a single card-shaped skeleton with a pulsing animation. The parent
 * (`LinksList`) renders this instead of `LinkCard` when `loadingLinks && page === 1`.
 */
export default function LinkCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading link"
      className="relative overflow-visible pl-10 pr-8 py-4 bg-[var(--bg-surface)] border-l-4 border-[var(--accent)] rounded-r-xl"
    >
      <div className="absolute left-0 top-4 -translate-x-1/2 w-8 h-8 rounded-2xl bg-[var(--accent)]" />
      <div className="space-y-1 animate-pulse">
        <div className="flex flex-row items-center">
          <div className="w-[60px] sm:w-[120px] h-[32px] sm:h-[63px] rounded-md bg-[var(--bg-elevated)] shrink-0" />
          <div className="flex flex-col items-start min-w-0 ml-3 gap-1.5 w-full">
            <div className="w-3/4 h-3.5 bg-[var(--bg-elevated)] rounded" />
            <div className="w-24 h-3 bg-[var(--bg-elevated)] rounded" />
          </div>
        </div>
        <div className="h-8 mt-2 space-y-1">
          <div className="w-full h-3 bg-[var(--bg-elevated)] rounded" />
          <div className="w-2/3 h-3 bg-[var(--bg-elevated)] rounded" />
        </div>
      </div>
    </div>
  );
}
