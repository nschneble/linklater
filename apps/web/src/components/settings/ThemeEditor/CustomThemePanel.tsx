import CopyFromTheme from './CopyFromTheme';
import CustomThemePickerToggle from './CustomThemePickerToggle';
import SettingsGroup from '../SettingsGroup';
import type { BaseTheme } from '../../../theme/constants';

interface CustomThemePanelProps {
  /** Whether the custom theme is enabled (master switch on). */
  enabled: boolean;
  /** Whether editing is unlocked — the copy menu is disabled until this is true. */
  editingEnabled: boolean;
  /** Called with the next value when the master switch flips. */
  onToggle: (enabled: boolean) => void;
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
 * Holds the two controls that gate everything below: the master enable switch
 * and the copy-palette shortcut. Each owns its own label, description, and fixed
 * escape-hatch focus ring (so a hostile custom palette can't hide them) — this
 * card only arranges them in the two-up layout the editing rows below echo
 * (switch fixed-width on the left, copy control flex-1).
 */
export default function CustomThemePanel({
  enabled,
  editingEnabled,
  onToggle,
  onApply,
  onPreviewTheme,
  undoThemeLabel,
  onUndo,
}: CustomThemePanelProps) {
  return (
    <SettingsGroup
      id="custom-theme"
      title="Your theme"
      icon="fa-paintbrush"
      description="Start from a blank palette, or copy a theme you already like."
    >
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="w-full lg:w-80 shrink-0">
          <CustomThemePickerToggle enabled={enabled} onChange={onToggle} />
        </div>
        <CopyFromTheme
          editingEnabled={editingEnabled}
          onApply={onApply}
          onPreviewTheme={onPreviewTheme}
          undoThemeLabel={undoThemeLabel}
          onUndo={onUndo}
        />
      </div>
    </SettingsGroup>
  );
}
