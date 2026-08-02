import IconButton from './IconButton';
import type { ReactNode } from 'react';

interface CopyButtonProps {
  /**
   * Visible button label. Defaults to "Copy to clipboard". When `label` is
   * omitted the native <button> derives its accessible name from this text,
   * so the spoken name always matches the visible name (WCAG 2.5.3).
   */
  children?: ReactNode;
  /**
   * Optional accessible-name OVERRIDE applied as `aria-label`. Use only when
   * a more descriptive spoken name is needed (e.g. visible "Copy", spoken
   * "Copy cURL command"). To keep WCAG 2.5.3 (Label in Name) satisfied, the
   * override MUST start with the visible text – the
   * `accessibleName.startsWith(visibleText)` contract is mechanized in
   * `CopyButton.test.tsx`. When omitted, NO aria-label is emitted and the
   * button's name is its visible text.
   */
  label?: string;
  /** Whether the button is in its post-copy "copied" state. */
  copied: boolean;
  /**
   * Which bundle surface hosts this button. Defaults to `'mount'` – every
   * current consumer lives inside a mount-tier surface (`SettingsGroup`,
   * `AuthCard`). The first base/orbit consumer must add base/orbit
   * default-variant pairs to `bundles.contrast.test.ts` per the
   * bundle-slot-add-reverify protocol; do not silently let it inherit mount
   * paint on a non-mount background.
   */
  surface?: 'base' | 'mount' | 'orbit';
  onCopy?: () => void | Promise<void>;
}

/**
 * Copy-to-clipboard button with a `data-copied` icon cross-fade (copy ↔ check).
 *
 * Announcement contract: this button does NOT announce the copy result. A
 * focused button's own label change is not reliably re-announced by screen
 * readers, so the CONSUMER must render its own polite live region
 * (`role="status"` / `aria-live="polite"`) rendered empty up-front and
 * populated with the success message on copy. See `CopyRevealPanel` for the
 * canonical sibling-live-region pattern.
 *
 * Name contract (WCAG 2.5.3 Label in Name): the visible text comes from
 * `children` (default "Copy to clipboard"). When `label` is omitted, no
 * aria-label is emitted and the native button name = visible text. When
 * `label` IS provided, it overrides the accessible name and MUST start with
 * the visible text; the icon stack is `aria-hidden` so it never participates
 * in the name.
 */
export default function CopyButton({
  children = 'Copy to clipboard',
  label,
  copied,
  surface = 'mount',
  onCopy,
}: CopyButtonProps) {
  return (
    <IconButton
      className="group"
      surface={surface}
      data-copied={copied ? 'true' : undefined}
      aria-label={label}
      onClick={() => void onCopy?.()}
    >
      <span aria-hidden="true" className="inline-grid place-items-center">
        <span className="col-start-1 row-start-1 opacity-0 blur-xs scale-[0.25] group-data-[copied]:opacity-100 group-data-[copied]:blur-none group-data-[copied]:scale-100 transition-[opacity,filter,scale] duration-300 ease-in-out motion-reduce:transition-none">
          <i className="fa-solid fa-check text-[0.7rem]" />
        </span>
        <span className="col-start-1 row-start-1 opacity-100 blur-none scale-100 group-data-[copied]:opacity-0 group-data-[copied]:blur-xs group-data-[copied]:scale-[0.25] transition-[opacity,filter,scale] duration-300 ease-in-out motion-reduce:transition-none">
          <i className="fa-solid fa-copy text-[0.7rem]" />
        </span>
      </span>
      {children}
    </IconButton>
  );
}
