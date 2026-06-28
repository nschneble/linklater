import type { ReactNode } from 'react';

interface ThemeRowContentProps {
  /**
   * Visible row label. The accessible NAME of the row is owned by the host's
   * `<button>` (this is just its text content), so the label stays a bare theme
   * name — typeahead in the copy menu matches on it.
   */
  label: string;
  /**
   * Optional trailing sr-only node rendered inside the label span (e.g. the
   * custom theme's "…, custom theme" state suffix). Visually hidden, so it never
   * affects layout.
   */
  labelSuffix?: ReactNode;
  /**
   * When true the label truncates on overflow (width-constrained menu rows);
   * otherwise it wraps (full-width flat list rows).
   */
  truncateLabel?: boolean;
  /** Font Awesome class overlaid on the color dot (decorative). */
  swatchIcon?: string;
  /**
   * Dot fill color. Falls back to the orbit alt-text color (with an orbit-bg
   * glyph) when omitted, so a bare row still tracks the popup surface; when
   * given, the dot uses the accent with a white glyph (theme identity).
   */
  accent?: string;
  /** Swatch dot dimensions, e.g. `w-3.5 h-3.5` or `w-5 h-5`. */
  swatchSize: string;
  /** Overlaid film glyph size, e.g. `text-[0.5rem]` or `text-[0.6rem]`. */
  glyphSize: string;
  /**
   * Host-owned node rendered BETWEEN the label and the accessible-theme glyph
   * (e.g. the flat list's selection checkmark). Kept out of this primitive so
   * role + selection state stay entirely host-owned (SC 4.1.2) while DOM order
   * is preserved.
   */
  afterLabel?: ReactNode;
  /** Renders the universal-access glyph + sr-only "Accessible theme" for AT. */
  isAccessible?: boolean;
}

/**
 * Role-agnostic CONTENT for a single theme row: the color swatch (dot + overlaid
 * film glyph), the label, and the optional accessible-theme glyph. It renders NO
 * `<button>`, role, tabindex, handlers, or selection state — each host wraps it
 * in its own correctly-roled control (a `menuitem` ACTION in the copy menu, a
 * `menuitemradio` SELECTION in the flat picker list) and owns the interaction
 * semantics, active styling, and any selection indicator. Sizes + spacing are
 * passed per host so the two pickers keep their distinct dimensions.
 */
export default function ThemeRowContent({
  label,
  labelSuffix,
  truncateLabel = false,
  swatchIcon,
  accent,
  swatchSize,
  glyphSize,
  afterLabel,
  isAccessible = false,
}: ThemeRowContentProps) {
  return (
    <>
      <span
        className={`relative shrink-0 inline-flex items-center justify-center ${swatchSize} bg-[var(--orbit-alt-text)] rounded-full`}
        style={accent ? { backgroundColor: accent } : undefined}
      >
        {swatchIcon && (
          <i
            className={`fa-solid ${swatchIcon} text-[var(--orbit-bg)] ${glyphSize}`}
            style={accent ? { color: '#ffffff' } : undefined}
            aria-hidden="true"
          />
        )}
      </span>
      <span className={`flex-1${truncateLabel ? ' truncate' : ''}`}>
        {label}
        {labelSuffix}
      </span>
      {afterLabel}
      {isAccessible && (
        <>
          <i
            className="fa-solid fa-universal-access shrink-0"
            aria-hidden="true"
          />
          <span className="sr-only">Accessible theme</span>
        </>
      )}
    </>
  );
}
