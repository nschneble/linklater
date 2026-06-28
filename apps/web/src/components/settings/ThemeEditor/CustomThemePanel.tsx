import CopyFromTheme from './CopyFromTheme';
import CustomThemeOffRamp from './CustomThemeOffRamp';
import SettingsGroup from '../SettingsGroup';
import type { BaseTheme } from '../../../theme/constants';

interface CustomThemePanelProps {
  /** Whether the custom theme is currently active (editing + saving). */
  active: boolean;
  /** Label of the theme the off-ramp returns to. */
  baseThemeLabel: string;
  /** Reverts to the named theme, keeping the saved palette. */
  onRevert: () => void;
  /** Applies a film theme's current-mode palette to the custom theme. */
  onApply: (themeId: BaseTheme, themeLabel: string) => void;
  /** Transiently previews a film theme under the active copy-menu row. */
  onPreviewTheme: (theme: BaseTheme | null) => void;
  /** Label of the last-applied theme, or `null` when there is nothing to undo. */
  undoThemeLabel: string | null;
  /** Reverts the last copy. */
  onUndo: () => void;
}

/**
 * The editor's master-control card, sitting between the page header and the
 * editing content. Reuses the app's `SettingsGroup` chrome (mount surface,
 * `fa-solid` icon + `<h2>` heading + description) so it reads like any other
 * settings section — but it does NOT register with the SettingsView scroll-spy.
 *
 * Holds the off-ramp (the "Back to {theme}" button, shown only while custom is
 * active) and the copy-palette shortcut. The off-ramp comes FIRST in DOM order
 * and paints from a fixed escape-hatch palette so it stays the legible way back
 * from a hostile custom palette; this card only arranges the two in the two-up
 * layout the editing rows below echo (off-ramp on the left, copy control flex-1).
 */
export default function CustomThemePanel({
  active,
  baseThemeLabel,
  onRevert,
  onApply,
  onPreviewTheme,
  undoThemeLabel,
  onUndo,
}: CustomThemePanelProps) {
  return (
    <SettingsGroup
      id="custom-theme"
      title="Theme starting point"
      icon="fa-paintbrush"
      description="Start from a blank palette, or copy a theme you already like."
    >
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-80 shrink-0">
          <CustomThemeOffRamp
            active={active}
            baseThemeLabel={baseThemeLabel}
            onRevert={onRevert}
          />
        </div>
        <CopyFromTheme
          editingEnabled={active}
          onApply={onApply}
          onPreviewTheme={onPreviewTheme}
          undoThemeLabel={undoThemeLabel}
          onUndo={onUndo}
        />
      </div>
    </SettingsGroup>
  );
}
