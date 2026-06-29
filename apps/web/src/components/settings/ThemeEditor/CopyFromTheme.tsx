import { useRef } from 'react';
import { EDITOR_FOCUS_RING } from './escapeHatchStyles';
import { THEMES } from '../../../theme/constants';
import ThemeCopyMenu from './ThemeCopyMenu';
import type { BaseTheme } from '../../../theme/constants';

const COPY_DESCRIPTION_ID = 'theme-editor-copy-description';

/**
 * Themes that can be copied FROM. The custom theme is excluded – copying the
 * custom palette into itself is a no-op, and its tokens may be empty.
 */
const COPYABLE_THEMES = THEMES.filter((theme) => theme.id !== 'custom');

interface CopyFromThemeProps {
  /**
   * Whether the custom theme is already active. Only switches the helper text:
   * the menu is ALWAYS operable — picking a theme while off is itself a way to
   * go custom (it seeds + saves the palette), equal to editing a color.
   */
  editingEnabled: boolean;
  /**
   * Activated when the user picks a theme. Applies that theme's CURRENT-mode
   * palette immediately and autosaves (no separate Copy button) — the parent
   * reads the tokens (it owns the active mode) and reveals Undo.
   */
  onApply: (themeId: BaseTheme, themeLabel: string) => void;
  /**
   * Transiently previews the theme under the active menu row (or `null` when
   * the menu closes). The editor wires this to a non-persisting full-page
   * repaint so the user can peek at a palette before applying it.
   */
  onPreviewTheme: (theme: BaseTheme | null) => void;
  /** The label of the last-applied theme, or `null` when there is nothing to undo. */
  undoThemeLabel: string | null;
  /** Reverts the last copy. */
  onUndo: () => void;
}

/**
 * "Start from a theme" control: a themed MENU whose rows are ACTIONS.
 * Picking a theme applies its current-mode palette to the custom theme
 * immediately and autosaves; an Undo button then appears to revert (recoverable
 * per SC 3.3.6, announced via the editor's polite auto-save region). There is
 * no two-step Copy button and no retained selection — see `ThemeCopyMenu` for
 * why this is a menu, not a combobox.
 *
 * The menu is ALWAYS operable: picking a theme while the custom theme is off is
 * itself a way to go custom (the parent seeds + saves the picked palette), so
 * copying a theme can START a custom theme, not just edit an active one. Its
 * trigger paints from fixed escape-hatch colors so it stays the legible way
 * back from an unreadable custom palette (the old "Reset all" hatch is gone).
 */
export default function CopyFromTheme({
  editingEnabled,
  onApply,
  onPreviewTheme,
  undoThemeLabel,
  onUndo,
}: CopyFromThemeProps) {
  const triggerReference = useRef<HTMLButtonElement>(null);

  function handleActivate(id: string) {
    const themeId = id as BaseTheme;
    const themeLabel =
      COPYABLE_THEMES.find((entry) => entry.id === themeId)?.label ?? themeId;
    onApply(themeId, themeLabel);
  }

  // Return focus to the trigger when Undo is activated. `onUndo` clears the
  // label (this button unmounts), so focus must move first or it falls to
  // <body> (SC 2.4.3 / 2.4.7). The trigger is always mounted, so focusing it is
  // safe regardless of React's commit timing; the `.focus()` runs synchronously
  // before the batched unmount.
  function handleUndo() {
    onUndo();
    triggerReference.current?.focus();
  }

  return (
    <div
      role="group"
      aria-label="Copy a palette"
      className="flex flex-1 flex-col gap-1.5"
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ThemeCopyMenu
          ref={triggerReference}
          options={COPYABLE_THEMES.map((theme) => ({
            id: theme.id,
            label: theme.label,
            swatchIcon: theme.swatchIcon,
            accent: theme.accent,
            isAccessible: theme.isAccessible,
          }))}
          label="Start from a theme"
          onActivate={handleActivate}
          onActivePreview={(id) => onPreviewTheme((id as BaseTheme) ?? null)}
          ariaDescribedBy={COPY_DESCRIPTION_ID}
          className="min-w-56"
        />

        {undoThemeLabel !== null && (
          <button
            type="button"
            onClick={handleUndo}
            aria-label={`Undo copy from ${undoThemeLabel}`}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 bg-[var(--mount-highlight)] text-[var(--mount-highlight-fg)] text-xs font-semibold ${EDITOR_FOCUS_RING} rounded-lg active:scale-[0.96] transition-transform cursor-pointer`}
          >
            <i className="fa-solid fa-arrow-rotate-left" aria-hidden="true" />
            Undo
          </button>
        )}
      </div>

      {/* Visible helper, promoted from sr-only: the trigger's describedby points
          here, so the instruction is one node seen by everyone (SC 3.3.2 / 1.3.1). */}
      <p
        id={COPY_DESCRIPTION_ID}
        className="text-[var(--mount-alt-text)] text-right text-xs"
      >
        {editingEnabled
          ? 'Picking a theme paints over your colors with its palette and saves. Undo to revert.'
          : 'Pick a theme to start yours — it turns on your theme and saves.'}
      </p>
    </div>
  );
}
