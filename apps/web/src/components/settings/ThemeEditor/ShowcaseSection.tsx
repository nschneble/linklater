import type { ReactNode } from 'react';

/**
 * A labeled section within `ComponentShowcase`. Renders a small-caps title
 * above its children.
 */
export default function ShowcaseSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <p className="mb-3 text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-wide font-semibold">
        {title}
      </p>
      {children}
    </div>
  );
}
