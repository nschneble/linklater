import type { CSSProperties } from 'react';

/**
 * Fixed neutral palettes for the Theme Editor's own critical controls (theme
 * select, mode toggle, Reset, Copy, Save). These deliberately do NOT read
 * bundle tokens: a hostile or broken bundle edit must never be able to make
 * the editor's escape hatches unreadable, so the user always has a visible way
 * out. Hoisted here so every control shares one source (light fill for most
 * controls, dark inverse for the Save button and the active mode segment).
 */
export const ESCAPE_HATCH_LIGHT: CSSProperties = {
  backgroundColor: '#fafafa',
  color: '#0a0a0a',
  borderColor: '#404040',
};

export const ESCAPE_HATCH_DARK: CSSProperties = {
  backgroundColor: '#0a0a0a',
  color: '#fafafa',
  borderColor: '#404040',
};
