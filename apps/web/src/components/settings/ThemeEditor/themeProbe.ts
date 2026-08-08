import { collectTokens, CUSTOM_TOKEN_KEYS } from '../../../theme/customTheme';
import type { BaseTheme, Mode } from '../../../theme/constants';

/**
 * Reads the resolved values of every `CUSTOM_TOKEN_KEYS` entry for a given
 * theme + mode by mounting a temporary off-screen element carrying the matching
 * `data-theme` / `data-mode` attributes and reading its computed style. The
 * element must be attached to the document for `getComputedStyle` to resolve
 * the `[data-theme]`-keyed cascade. Empty resolutions are dropped.
 *
 * Used to seed the custom palette from a film theme: both for "copy from
 * theme" and for the initial seed when the user first enables the custom theme.
 */
export function readThemeTokens(
  theme: BaseTheme,
  mode: Mode,
): Record<string, string> {
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
    return collectTokens(CUSTOM_TOKEN_KEYS, (variable) =>
      computed.getPropertyValue(variable).trim(),
    );
  } finally {
    document.body.removeChild(probe);
  }
}
