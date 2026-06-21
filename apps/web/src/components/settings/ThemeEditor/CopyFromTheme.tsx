import { useState } from 'react';
import { CUSTOM_TOKEN_KEYS } from '../../../theme/customTheme';
import { THEMES } from '../../../theme/constants';
import type { BaseTheme, Mode } from '../../../theme/constants';

const COPY_DESCRIPTION_ID = 'theme-editor-copy-description';
const COPY_SELECT_ID = 'theme-editor-copy-select';

/**
 * Themes that can be copied FROM. The custom theme is excluded – copying the
 * custom palette into itself is a no-op, and its tokens may be empty.
 */
const COPYABLE_THEMES = THEMES.filter((theme) => theme.id !== 'custom');

/** A per-mode resolved token map read from a source theme's cascade. */
export interface CopiedTokens {
  dark: Record<string, string>;
  light: Record<string, string>;
}

/**
 * Reads the resolved values of every `CUSTOM_TOKEN_KEYS` entry for a given
 * theme + mode by mounting a temporary off-screen element carrying the
 * matching `data-theme` / `data-mode` attributes and reading its computed
 * style. The element must be attached to the document for `getComputedStyle`
 * to resolve the `[data-theme]`-keyed cascade. Empty resolutions are dropped.
 */
function readThemeTokens(theme: BaseTheme, mode: Mode): Record<string, string> {
  const probe = document.createElement('div');
  probe.dataset.theme = theme;
  probe.dataset.mode = mode;
  probe.style.position = 'absolute';
  probe.style.width = '0';
  probe.style.height = '0';
  probe.style.overflow = 'hidden';
  probe.setAttribute('aria-hidden', 'true');
  document.body.appendChild(probe);
  try {
    const computed = getComputedStyle(probe);
    const tokens: Record<string, string> = {};
    for (const variable of CUSTOM_TOKEN_KEYS) {
      const value = computed.getPropertyValue(variable).trim();
      if (value !== '') {
        tokens[variable] = value;
      }
    }
    return tokens;
  } finally {
    document.body.removeChild(probe);
  }
}

interface CopyFromThemeProps {
  /** Whether the editor's selected theme is the editable custom theme. */
  isCustom: boolean;
  /**
   * Invoked with the source theme's resolved tokens for BOTH modes plus its
   * label. The parent seeds the editor's override state from the current
   * mode's tokens and may persist either mode on Save.
   */
  onCopy: (tokens: CopiedTokens, themeLabel: string) => void;
}

const COPY_NON_CUSTOM_HINT =
  'Copying is available for the custom theme only. Switch the theme selector to Custom to copy a palette.';

/**
 * Two-step "Copy palette from theme" control: a native `<select>` paired with
 * an explicit Copy `<button>`. Overwriting the editor's tokens is destructive,
 * so it must NOT fire on select `onChange` (a11y brief B2 – SC 3.2.2 On
 * Input). The select carries a visible `<label>` (not aria-label only,
 * justified because the action is destructive) and the Copy button a static
 * `aria-describedby` warning that the copy replaces current edits (SC 3.3.2).
 *
 * Like Save, the control stays PRESENT and `aria-disabled` for non-custom
 * themes rather than unmounting (B6).
 */
export default function CopyFromTheme({
  isCustom,
  onCopy,
}: CopyFromThemeProps) {
  const [selected, setSelected] = useState('');

  const isInactive = !isCustom || selected === '';

  function handleCopy() {
    if (isInactive) return;
    const theme = selected as BaseTheme;
    const themeLabel =
      COPYABLE_THEMES.find((entry) => entry.id === theme)?.label ?? theme;
    onCopy(
      {
        dark: readThemeTokens(theme, 'dark'),
        light: readThemeTokens(theme, 'light'),
      },
      themeLabel,
    );
  }

  return (
    <div
      role="group"
      aria-label="Copy palette from theme"
      className="flex items-end gap-2"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor={COPY_SELECT_ID}
          className="text-[var(--base-alt-text)] text-[0.65rem] font-medium"
        >
          Copy palette from theme
        </label>
        <select
          id={COPY_SELECT_ID}
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          style={{
            backgroundColor: '#fafafa',
            color: '#0a0a0a',
            borderColor: '#404040',
          }}
          className="px-2.5 py-1.5 border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg cursor-pointer"
        >
          <option value="">Select a theme to copy…</option>
          {COPYABLE_THEMES.map((theme) => (
            <option key={theme.id} value={theme.id}>
              {theme.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        aria-disabled={isInactive}
        aria-describedby={COPY_DESCRIPTION_ID}
        style={{
          backgroundColor: '#fafafa',
          color: '#0a0a0a',
          borderColor: '#404040',
        }}
        className="px-2.5 py-1.5 border text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg active:scale-[0.96] aria-disabled:opacity-50 aria-disabled:active:scale-100 aria-disabled:cursor-not-allowed cursor-pointer transition-transform"
      >
        Copy
      </button>

      <p id={COPY_DESCRIPTION_ID} className="sr-only">
        {isCustom
          ? 'Copying replaces all current edits in your custom theme.'
          : COPY_NON_CUSTOM_HINT}
      </p>
    </div>
  );
}

export { readThemeTokens };
