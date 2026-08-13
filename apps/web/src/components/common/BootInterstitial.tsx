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
 *
 * Branding is pinned here for the same reason the logged-out auth surfaces
 * pin it (`routes/Unauthenticated.tsx`), and one more. Without it the
 * screen inherits the root, which turns over to the user's own theme
 * partway through the dwell, once the profile has landed but before the
 * app takes the screen. A pulse between two foregrounds is only as safe
 * as the pair, and an editable theme can hold a legal pair whose
 * midpoints fall under the floor; the editor scores each foreground
 * against the background alone and never against the other. Pinning the
 * palette makes both endpoints known, and drops a mid-screen theme flip.
 */
export default function BootInterstitial() {
  return (
    <div
      data-theme="branding"
      className="flex items-center justify-center min-h-svh bg-[var(--base-bg)] text-[var(--base-text)] select-none"
    >
      <div className="text-[var(--base-alt-text)] text-sm animate-boot-pulse">
        Defrosting Linklater in the microwave…
      </div>
    </div>
  );
}
