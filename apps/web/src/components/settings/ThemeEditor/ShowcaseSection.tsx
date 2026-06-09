import type { ReactNode } from 'react';

/**
 * A labeled section within `ComponentShowcase`. Renders a small-caps `<h3>`
 * title above its children so the editor's heading outline stays
 * navigable for screen-reader users.
 */
export default function ShowcaseSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-3 text-[var(--text-subtle)] text-[0.65rem] uppercase tracking-wide font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}
