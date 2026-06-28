type StatusBundle = 'alert' | 'warn' | 'info' | 'success';

interface MockNoticeProps {
  bundle: StatusBundle;
  icon: string;
  title: string;
  detail: string;
}

/**
 * One static status notification in the app mock (alert / warn / info /
 * success). Decorative only: no role="alert"/"status", no aria-live — the
 * whole mock re-renders on every color edit, so a live region would
 * re-announce on every keystroke. Paints every slot of its status bundle so
 * the editor can verify that bundle's contrast in realistic context.
 */
export default function MockNotice({
  bundle,
  icon,
  title,
  detail,
}: MockNoticeProps) {
  return (
    <div
      className="flex items-start gap-2.5 px-3 py-2.5 border rounded-lg"
      style={{
        backgroundColor: `var(--${bundle}-bg)`,
        borderColor: `var(--${bundle}-border)`,
      }}
    >
      <span
        className="flex shrink-0 items-center justify-center w-6 h-6 rounded-md"
        style={{
          backgroundColor: `var(--${bundle}-highlight)`,
          color: `var(--${bundle}-highlight-fg)`,
        }}
      >
        <i className={`${icon} text-[0.7rem]`} aria-hidden="true" />
      </span>
      <div className="flex-1 min-w-0">
        <p
          className="text-[0.72rem] font-semibold"
          style={{ color: `var(--${bundle}-text)` }}
        >
          {title}
        </p>
        <p
          className="text-[0.65rem]"
          style={{ color: `var(--${bundle}-alt-text)` }}
        >
          {detail}
        </p>
      </div>
      <span
        className="mt-1 w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: `var(--${bundle}-highlight-hover)` }}
      />
    </div>
  );
}
