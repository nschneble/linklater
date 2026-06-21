import {
  getActiveSettingsSection,
  reanchorSettingsSection,
} from './settingsScroll';
import { useEffect, useRef } from 'react';

/**
 * Re-anchors the section the user last navigated to (via
 * `reanchorSettingsSection`) when an async-loading sub-section transitions
 * from `loading` to `loaded`.
 *
 * Why: jumping to a section near the page bottom (e.g. a `scrollTo`
 * navigation to `integrations`) lands at an offset based on the page geometry
 * at first paint – before child sections like the PAT list and the
 * bookmarklet token have resolved. As those settle in, content above the
 * target section grows and the target section slides off the upper edge.
 * The old implementation used a `ResizeObserver` on `document.body`; this
 * hook replaces it with a deterministic data-state edge.
 *
 * The target section is read from the module-level accessor
 * `getActiveSettingsSection` (written by `useSettingsActiveSection` on every
 * deliberate navigation) because this hook runs inside async leaf sections
 * that have no access to the active-section React state. A plain `/settings`
 * visit never activates a section, so the accessor is empty and this no-ops.
 *
 * The re-fire is gated on the user not having produced real scroll input
 * since mount (wheel / touchmove). If they have, they've taken control of
 * the viewport and we must not yank them back. The re-anchor does not move
 * focus (the initial navigation already placed it), so a user who tabbed
 * away is never pulled back out of their flow.
 *
 * Called by each async section that can extend the page height after first
 * paint. It re-fires once per loading transition; subsequent updates (e.g.
 * regenerate flows) do not re-fire because they are not loading→loaded
 * transitions.
 */
export function useReanchorOnLoad(loaded: boolean): void {
  const previouslyLoaded = useRef(loaded);
  const userScrolled = useRef(false);

  useEffect(() => {
    function markScrolled() {
      userScrolled.current = true;
    }
    window.addEventListener('wheel', markScrolled, { passive: true });
    window.addEventListener('touchmove', markScrolled, { passive: true });
    return () => {
      window.removeEventListener('wheel', markScrolled);
      window.removeEventListener('touchmove', markScrolled);
    };
  }, []);

  useEffect(() => {
    const wasLoaded = previouslyLoaded.current;
    previouslyLoaded.current = loaded;
    if (wasLoaded || !loaded) return;
    if (userScrolled.current) return;
    const section = getActiveSettingsSection();
    if (!section) return;
    if (!document.getElementById(section)) return;
    reanchorSettingsSection(section);
  }, [loaded]);
}
