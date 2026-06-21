import {
  scrollToSettingsSection,
  setActiveSettingsSection,
} from './settingsScroll';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseSettingsActiveSectionOptions {
  /** Section ids in document order. Only these are valid activation targets. */
  sectionIds: string[];
}

/**
 * Backstop that clears the active section after a period of inactivity. Covers
 * screen-reader virtual-cursor users, whose reading cursor moves through the
 * page without firing `pointerdown` or `focusin` – without this they could
 * strand the accent indicator on a section they have long since read past.
 */
const CLEAR_SAFETY_MS = 5000;

/**
 * Owns the single "active section" state for the Settings page. The state is
 * deliberate, not positional: it is set only when the user explicitly
 * navigates to a section (sidebar/chip click, or a router-state `scrollTo`
 * jump) and is cleared the moment they interact outside it. It is NOT tied to
 * scroll position – scrolling away leaves the indicator in place until an
 * outside interaction (or the safety timeout) clears it.
 *
 * `activeSection` drives both the section card's accent indicator
 * (`SettingsGroup data-active`) and the clicked nav item's `aria-current`, so
 * the visual and programmatic states share one source and cannot drift.
 *
 * Clearing covers every input modality: `pointerdown` (mouse/touch),
 * `focusin` (Tab/AT focus jumps), `Escape` (keyboard escape hatch), and a
 * timeout backstop. Scroll input deliberately does NOT clear.
 */
export function useSettingsActiveSection({
  sectionIds,
}: UseSettingsActiveSectionOptions) {
  const [activeSection, setActiveSection] = useState<string>('');
  const activeSectionRef = useRef<string>('');
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mirror the state into a ref so the document-level listeners can read the
  // current value without re-binding every time it changes.
  useEffect(() => {
    activeSectionRef.current = activeSection;
  }, [activeSection]);

  const clearActiveSection = useCallback(() => {
    if (!activeSectionRef.current) return;
    setActiveSection('');
    activeSectionRef.current = '';
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
  }, []);

  const activateSection = useCallback(
    (hash: string) => {
      if (!sectionIds.includes(hash)) return;
      // Sync the ref BEFORE moving focus: `scrollToSettingsSection` focuses the
      // target, which fires `focusin`. The clear-guard reads `activeSectionRef`
      // to decide whether that focus landed inside the active section; if the
      // ref still held the previous value, the guard would clear the state we
      // just set.
      setActiveSection(hash);
      activeSectionRef.current = hash;
      setActiveSettingsSection(hash);
      scrollToSettingsSection(hash);
      if (clearTimer.current) clearTimeout(clearTimer.current);
      clearTimer.current = setTimeout(clearActiveSection, CLEAR_SAFETY_MS);
    },
    [sectionIds, clearActiveSection],
  );

  useEffect(() => {
    function handleInteractOutside(event: PointerEvent | FocusEvent) {
      const activeId = activeSectionRef.current;
      if (!activeId) return;
      const activeElement = document.getElementById(activeId);
      if (activeElement && activeElement.contains(event.target as Node)) return;
      clearActiveSection();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') clearActiveSection();
    }
    document.addEventListener('pointerdown', handleInteractOutside);
    document.addEventListener('focusin', handleInteractOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleInteractOutside);
      document.removeEventListener('focusin', handleInteractOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [clearActiveSection]);

  useEffect(() => {
    return () => {
      if (clearTimer.current) clearTimeout(clearTimer.current);
    };
  }, []);

  return { activeSection, activateSection };
}
