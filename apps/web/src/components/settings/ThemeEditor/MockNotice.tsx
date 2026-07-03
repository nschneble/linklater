type StatusBundle = 'alert' | 'warn' | 'info' | 'success';

interface MockNoticeProps {
  bundle: StatusBundle;
  icon: string;
  banner: string;
  toast: string;
}

/**
 * The static status previews in the app mock (alert / warn / info / success),
 * mirroring the TWO real status forms each status bundle paints: an inline
 * `Alert` banner (bundle bg + border, inline bundle-text icon and copy) stacked
 * above a `Toast` pill (bundle-highlight fill, bundle-highlight-fg icon + copy +
 * a decorative close glyph). Decorative only: no role="alert"/"status", no
 * aria-live — the whole mock re-renders on every color edit, so a live region
 * would re-announce on every keystroke. Between them the two forms paint the
 * bundle's bg, border, text, highlight, and highlight-fg slots in realistic
 * context so the editor can preview that bundle's contrast.
 */
export default function MockNotice({
  bundle,
  icon,
  banner,
  toast,
}: MockNoticeProps) {
  return (
    <div className="space-y-2.5">
      <div
        className="flex items-center justify-center gap-2 px-3 py-2 border rounded-lg"
        style={{
          backgroundColor: `var(--${bundle}-bg)`,
          borderColor: `var(--${bundle}-border)`,
          color: `var(--${bundle}-text)`,
        }}
      >
        <i className={`${icon} text-[0.7rem]`} aria-hidden="true" />
        <span className="text-[0.7rem]">{banner}</span>
      </div>

      <div
        className="flex items-center gap-2 w-fit px-4 py-2.5 rounded-full"
        style={{
          backgroundColor: `var(--${bundle}-highlight)`,
          color: `var(--${bundle}-highlight-fg)`,
        }}
      >
        <i className={`${icon} text-[0.7rem]`} aria-hidden="true" />
        <span className="text-[0.7rem] font-medium">{toast}</span>
        <i className="fa-solid fa-xmark text-[0.7rem]" aria-hidden="true" />
      </div>
    </div>
  );
}
