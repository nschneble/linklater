import type { Bundle } from './useThemeOverrides';

interface MockBannerProps {
  bundle: Bundle;
  icon: string;
  text: string;
}

// Bundles that aren't status colors. When the editor sits on one of these, the
// banner paints a bundle the user isn't editing, so it renders muted
// (grayscale) to read as "not the selected color".
const MUTED_BUNDLES = new Set<Bundle>(['base', 'mount', 'orbit']);

export default function MockBanner({ bundle, icon, text }: MockBannerProps) {
  return (
    <div
      className="flex items-center justify-center gap-2 px-3 py-2 border-b data-muted:grayscale data-muted:opacity-10"
      data-muted={MUTED_BUNDLES.has(bundle) || undefined}
      style={{
        backgroundColor: `var(--${bundle}-bg)`,
        borderColor: `var(--${bundle}-border)`,
        color: `var(--${bundle}-text)`,
      }}
    >
      <i className={`${icon} text-[0.7rem]`} aria-hidden="true" />
      <span className="text-[0.7rem]">{text}</span>
    </div>
  );
}
