/**
 * The visible boot screen, shown only once a boot has run long enough to be
 * worth explaining (see `useBootStatus`).
 *
 * It carries no live-region semantics on purpose. App owns a single polite
 * region that outlives this screen; a second region appearing and being
 * removed again is how an utterance ends up describing a screen that is
 * already gone. The joke stays readable to the virtual cursor, so no
 * `aria-hidden` either.
 *
 * The message pulses color rather than opacity. An opacity trough drops
 * `--base-alt-text` on `--base-bg` under the 4.5:1 floor on nearly every
 * palette, and this screen now appears only on slow boots, where it runs for
 * many full cycles in front of someone reading it.
 */
export default function BootInterstitial() {
  return (
    <div className="flex items-center justify-center min-h-svh bg-[var(--base-bg)] text-[var(--base-text)] select-none">
      <div className="text-[var(--base-alt-text)] text-sm animate-boot-pulse">
        Defrosting Linklater in the microwave…
      </div>
    </div>
  );
}
