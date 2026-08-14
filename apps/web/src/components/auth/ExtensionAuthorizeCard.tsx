import type { ReactNode } from 'react';

/**
 * The page chrome all three branches of the extension consent route share.
 *
 * Not `AuthCard`, which is the card alone: this route renders outside
 * `AppShell`, so it owns its own `<main>` landmark and the full-height
 * gradient behind it. The landmark carries no `id` or `tabIndex` on
 * purpose, since the skip link that would target one lives in `AppShell`
 * and never reaches here.
 *
 * "branding" pins the surface the way the other auth wrappers do. A
 * signed-out visitor is painted branding already, so what the pin buys is
 * the consent prompt a signed-in user sees: the gradient stops are not
 * editable-theme tokens, so under the Custom theme they fall to the
 * synthetic default while the card and its alert keep the saved palette,
 * dropping the alert's text and border below their AA thresholds.
 *
 * It is wider than the theme that needed it. The pin declares all seven
 * bundles here, so every signed-in user sees this route in branding navy,
 * including the ten film themes that never had the bug. That is the
 * trade taken on purpose: one appearance for a route that is a handoff
 * rather than a place, against a per-theme carve-out that would have to
 * be re-derived every time a bundle slot moves.
 */

interface ExtensionAuthorizeCardProps {
  children: ReactNode;
  className?: string;
}

export default function ExtensionAuthorizeCard({
  children,
  className = '',
}: ExtensionAuthorizeCardProps) {
  return (
    <main
      data-theme="branding"
      className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]"
    >
      <div
        className={`w-full max-w-md mx-auto p-8 bg-[var(--mount-bg)] border-shadow text-center rounded-2xl ${className}`}
      >
        {children}
      </div>
    </main>
  );
}
