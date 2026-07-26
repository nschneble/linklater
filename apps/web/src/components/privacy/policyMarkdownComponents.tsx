import type { Components } from 'react-markdown';

/**
 * react-markdown passes its hast `node` alongside the HTML props; spreading
 * it onto a DOM element would trigger React's unknown-prop warning, so every
 * mapping strips it first.
 */
function withoutNode<Properties extends { node?: unknown }>(
  properties: Properties,
): Omit<Properties, 'node'> {
  const cleaned = { ...properties };
  delete cleaned.node;
  return cleaned;
}

/**
 * Tag → element mapping for the rendered privacy policy markdown.
 *
 * The markdown's own `# Privacy Policy` h1 is demoted to the sr-only h2 that
 * labels `<main>` — the visible page h1 lives in the chrome header
 * (PrivacyPolicyPage), so the document keeps exactly one h1 and the
 * markdown's `##` sections sit correctly as h2 siblings below it.
 *
 * Links are underlined because color alone cannot mark a link inside flowing
 * prose (SC 1.4.1), and they keep the contract-tested `--base-text` color so
 * contrast holds on every theme, including the brand navy. External links
 * open in the same tab — no un-submitted state is at risk on this page.
 */
export const policyMarkdownComponents: Components = {
  h1: ({ children, ...properties }) => (
    <h2
      className="sr-only"
      id="privacy-policy-heading"
      {...withoutNode(properties)}
    >
      {children}
    </h2>
  ),
  h2: ({ children, ...properties }) => (
    <h2
      className="mt-10 mb-4 text-[var(--base-text)] text-2xl font-semibold tracking-tight"
      {...withoutNode(properties)}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...properties }) => (
    <h3
      className="mt-8 mb-3 text-[var(--base-text)] text-xl font-semibold"
      {...withoutNode(properties)}
    >
      {children}
    </h3>
  ),
  p: (properties) => (
    <p
      className="my-4 text-[var(--base-text)] text-base leading-relaxed"
      {...withoutNode(properties)}
    />
  ),
  ul: (properties) => (
    <ul
      className="my-4 pl-6 list-disc space-y-2"
      {...withoutNode(properties)}
    />
  ),
  li: (properties) => (
    <li
      className="text-[var(--base-text)] text-base leading-relaxed"
      {...withoutNode(properties)}
    />
  ),
  blockquote: (properties) => (
    <blockquote
      className="my-4 pl-4 border-l-2 border-[var(--base-border)]"
      {...withoutNode(properties)}
    />
  ),
  a: ({ children, ...properties }) => (
    <a
      className="text-[var(--base-text)] underline underline-offset-2 decoration-1 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] rounded-xs"
      {...withoutNode(properties)}
    >
      {children}
    </a>
  ),
  table: ({ children, ...properties }) => (
    // Scrollable + keyboard-reachable region so the wide table reflows at
    // 320px without clipping (SC 1.4.10) and keyboard-only users can scroll
    // the region (SC 2.1.1) — same shape as CodeBlock's scroll container.
    // The sr-only caption gives the table a name in screen-reader table
    // lists.
    <div
      role="region"
      aria-label="How we use your information"
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className="my-6 overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
    >
      <table className="w-full border-collapse" {...withoutNode(properties)}>
        <caption className="sr-only">
          Processing purposes, data used, and GDPR legal basis
        </caption>
        {children}
      </table>
    </div>
  ),
  th: (properties) => (
    <th
      scope="col"
      className="px-3 py-2 border border-[var(--base-border)] text-[var(--base-text)] text-left text-sm font-semibold"
      {...withoutNode(properties)}
    />
  ),
  td: (properties) => (
    <td
      className="px-3 py-2 border border-[var(--base-border)] text-[var(--base-text)] text-sm align-top"
      {...withoutNode(properties)}
    />
  ),
};
