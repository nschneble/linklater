const TOGGLE_ID = 'theme-editor-show-custom';
const TOGGLE_DESCRIPTION_ID = 'theme-editor-show-custom-description';

interface CustomThemePickerToggleProps {
  /** Whether the custom theme is enabled: editable + saving here, and shown in the picker menus. */
  enabled: boolean;
  /** Called with the next value when the user flips the switch. */
  onChange: (enabled: boolean) => void;
}

/**
 * Master switch for the custom theme. While OFF the editor mirrors the user's
 * real theme with the color pickers locked; flipping it ON seeds the palette,
 * switches the page to custom, and unlocks editing — and also shows the custom
 * theme in the user-menu pickers. The state self-announces via the `switch`
 * role, so no live-region confirmation is needed on flip; a failed save is
 * announced separately by the editor's Toast.
 *
 * Built as a real `<input type="checkbox" role="switch">` so the native
 * element owns checked/keyboard/focus and AT announces "switch, on/off". The
 * painted track + thumb are an aria-hidden sibling driven entirely off the
 * peer's `:checked`/`:focus-visible` state — no JS class ternaries.
 *
 * Rendered inside the editor's two-up settings card (mount surface) beside the
 * copy-palette control, the track/thumb/label all paint from the active theme's
 * `--mount-*` tokens. The thumb color inverts with state (`--mount-text` off →
 * `--mount-highlight-fg` on) so it stays readable against both the inset track
 * and the filled track. The focus ring stays a FIXED blue like the editor's
 * other chrome, so a hostile custom palette can never hide keyboard focus.
 */
export default function CustomThemePickerToggle({
  enabled,
  onChange,
}: CustomThemePickerToggleProps) {
  return (
    <div>
      <label
        htmlFor={TOGGLE_ID}
        className="inline-flex items-center gap-3 min-h-[24px] cursor-pointer"
      >
        <span className="relative inline-flex shrink-0 items-center">
          <input
            id={TOGGLE_ID}
            type="checkbox"
            role="switch"
            checked={enabled}
            onChange={(event) => onChange(event.target.checked)}
            aria-describedby={TOGGLE_DESCRIPTION_ID}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className="block w-9 h-5 bg-[var(--mount-input-bg)] border border-[var(--mount-border)] peer-checked:bg-[var(--mount-highlight)] peer-checked:border-[var(--mount-highlight)] peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500 forced-colors:peer-focus-visible:outline-2 forced-colors:peer-focus-visible:outline-[ButtonText] rounded-full transition-colors"
          />
          <span
            aria-hidden="true"
            className="absolute top-0.5 left-0.5 w-4 h-4 bg-[var(--mount-text)] peer-checked:bg-[var(--mount-highlight-fg)] peer-checked:translate-x-4 rounded-full motion-safe:transition-transform"
          />
        </span>
        <span className="text-[var(--mount-text)] text-sm font-medium select-none">
          Use your theme
        </span>
      </label>
      <p
        id={TOGGLE_DESCRIPTION_ID}
        className="mt-1.5 max-w-prose text-[var(--mount-alt-text)] text-xs"
      >
        Off by default. Flip it on to edit your colors here and show your theme
        in the picker alongside the built-in ones.
      </p>
    </div>
  );
}
