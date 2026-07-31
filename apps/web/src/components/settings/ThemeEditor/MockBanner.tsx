import type { Bundle } from './useThemeOverrides';

interface MockBannerProps {
  bundle: Bundle;
  icon: string;
  text: string;
}

// non-status bundles the editor isn't coloring; render muted (grayscale)
const MUTED_BUNDLES = new Set<Bundle>(['base', 'mount', 'orbit']);

export default function MockBanner({ bundle, icon, text }: MockBannerProps) {
  return (
    <div
      className="flex items-center justify-center gap-2 px-3 py-2 border-b data-muted:grayscale data-muted:opacity-30 transition duration-200"
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
