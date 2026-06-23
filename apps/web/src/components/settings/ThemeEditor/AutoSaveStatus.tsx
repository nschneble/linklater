import { useEffect, useState } from 'react';
import { ESCAPE_HATCH_LIGHT } from './escapeHatchStyles';

interface AutoSaveStatusProps {
  /** Whether the editor's selected theme is the editable custom theme. */
  isCustom: boolean;
  /** Whether a save round-trip is currently in flight. */
  isSaving: boolean;
  /**
   * Increments once per successful auto-save. Drives the polite announcement;
   * `0` means nothing has been saved yet this session.
   */
  savedCount: number;
  /** Live count of failing WCAG contrast pairs (visible warning only). */
  failingCount: number;
}

/**
 * Replaces the old explicit Save button. For the custom theme it shows an
 * ambient, VISIBLE-ONLY (`aria-hidden`) "Saving…/Saved" affordance plus the
 * live failing-contrast warning, and announces each settled save exactly once
 * through a polite live region.
 *
 * The "Saving…/Saved" text and the contrast warning are deliberately NOT live
 * regions: they change on nearly every keystroke and would barrage assistive
 * tech. The contrast warning carries its meaning with an icon + text (not color
 * alone, WCAG 1.4.1). Only the discrete, debounced save SETTLEMENT is announced
 * (a11y brief B2/B5). Save FAILURES are announced separately by the editor's
 * assertive Toast — they never share this polite channel.
 *
 * For the built-in themes (preview-only, never persisted) it states that edits
 * are a live preview and only the custom theme saves.
 */
export default function AutoSaveStatus({
  isCustom,
  isSaving,
  savedCount,
  failingCount,
}: AutoSaveStatusProps) {
  const [announcement, setAnnouncement] = useState('');

  // Re-announce on every settled save: clear first so an identical message
  // string still triggers the live region (it only fires on content change).
  useEffect(() => {
    if (savedCount === 0) return;
    setAnnouncement('');
    const timer = setTimeout(() => setAnnouncement('Custom theme saved.'), 50);
    return () => clearTimeout(timer);
  }, [savedCount]);

  if (!isCustom) {
    return (
      <p className="text-[var(--base-subtle-text)] text-[0.65rem]">
        Live preview. Switch the theme to Yours to save your changes.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {failingCount > 0 && (
        // Fixed-color chip, like the Reset escape hatch: this warning reports
        // that the custom palette has unreadable pairs, so it must stay legible
        // even when those very colors are broken — it can't paint from the
        // theme tokens it is warning about. The triangle glyph is the
        // second channel (WCAG 1.4.1); #92400e on #fafafa measures ~6:1.
        <p
          style={{ ...ESCAPE_HATCH_LIGHT, color: '#92400e' }}
          className="flex items-center gap-1 px-2 py-0.5 border text-[0.65rem] font-medium rounded-md"
        >
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />
          {failingCount} contrast {failingCount === 1 ? 'pair' : 'pairs'}{' '}
          failing
        </p>
      )}

      <p
        className="flex items-center gap-1.5 text-[var(--base-subtle-text)] text-[0.65rem]"
        aria-hidden="true"
      >
        {isSaving && (
          <>
            <i
              className="fa-solid fa-circle-notch motion-safe:animate-spin"
              aria-hidden="true"
            />
            Saving…
          </>
        )}
        {!isSaving && savedCount > 0 && (
          <>
            <i className="fa-solid fa-check" aria-hidden="true" />
            All changes saved
          </>
        )}
        {!isSaving && savedCount === 0 && 'Changes save automatically'}
      </p>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
