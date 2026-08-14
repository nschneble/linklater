import type { ReactNode } from 'react';

/**
 * The page chrome all three branches of the extension consent route share.
 *
 * Not `AuthCard`, which is the card alone: this route renders outside
 * `AppShell`, so it owns its own `<main>` landmark and the full-height
 * gradient behind it. The landmark carries no `id` or `tabIndex` on
 * purpose, since the skip link that would target one lives in `AppShell`
 * and never reaches here.
 */
export default function ExtensionAuthorizeCard({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <main className="flex items-center justify-center min-h-screen px-4 bg-gradient-to-b from-[var(--page-gradient-from)] to-[var(--page-gradient-to)]">
      <div
        className={`w-full max-w-md mx-auto p-8 bg-[var(--mount-bg)] border-shadow text-center rounded-2xl ${className}`}
      >
        {children}
      </div>
    </main>
  );
}
