import CopyFromTheme from './CopyFromTheme';
import SettingsGroup from '../SettingsGroup';
import type { BaseTheme } from '../../../theme/constants';

interface CustomThemePanelProps {
  /** Whether the custom theme is currently active (editing + saving). */
  active: boolean;
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
 * Holds the copy-palette shortcut: the picker trigger paints from a fixed
 * escape-hatch palette and this card sits OUTSIDE the custom preview scope, so
 * copying a film theme stays the legible recovery from a hostile custom palette.
 */
export default function CustomThemePanel({
  active,
  onApply,
  onPreviewTheme,
  undoThemeLabel,
  onUndo,
}: CustomThemePanelProps) {
  return (
    <SettingsGroup
      id="custom-theme"
      title="Craft your theme"
      icon="fa-paintbrush"
      description="Start from a blank palette or copy an existing theme."
    >
      <CopyFromTheme
        editingEnabled={active}
        onApply={onApply}
        onPreviewTheme={onPreviewTheme}
        undoThemeLabel={undoThemeLabel}
        onUndo={onUndo}
      />
    </SettingsGroup>
  );
}
