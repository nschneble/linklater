import type { Bundle } from './useThemeOverrides';

interface MockToastProps {
  bundle: Bundle;
  icon: string;
  text: string;
}

// Bundles that aren't status colors. When the editor sits on one of these, the
// toast paints a bundle the user isn't editing, so it renders muted (grayscale)
// to read as "not the selected color".
const MUTED_BUNDLES = new Set<Bundle>(['base', 'mount', 'orbit']);

export default function MockToast({ bundle, icon, text }: MockToastProps) {
  return (
    <div
      className="flex items-center gap-2 w-fit mx-auto px-4 py-2.5 rounded-full data-muted:grayscale data-muted:opacity-30 transition duration-200"
      data-muted={MUTED_BUNDLES.has(bundle) || undefined}
      style={{
        backgroundColor: `var(--${bundle}-highlight)`,
        color: `var(--${bundle}-highlight-fg)`,
      }}
    >
      <i className={`${icon} text-[0.7rem]`} aria-hidden="true" />
      <span className="text-[0.7rem] font-medium">{text}</span>
      <i className="fa-solid fa-xmark text-[0.7rem]" aria-hidden="true" />
    </div>
  );
}
