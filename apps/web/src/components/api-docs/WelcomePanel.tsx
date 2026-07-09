import { WELCOME_HEADING_ID } from './useApiReferenceSelection';

/**
 * The default detail panel, shown when no endpoint is selected (empty hash).
 * An orientation surface with the app's voice and the mount-bundle card chrome
 * of an endpoint detail, so the page never opens on an empty right column.
 *
 * The `<h3>` carries `tabIndex={-1}` so the selection effect can move focus
 * here when the user returns to the overview, matching the focus-to-heading
 * behavior of an endpoint swap.
 */

interface WelcomePanelProps {
  serverOrigin: string;
}

interface OverviewPoint {
  icon: string;
  term: string;
  detail: string;
}

export default function WelcomePanel({ serverOrigin }: WelcomePanelProps) {
  const baseUrl =
    serverOrigin === '' ? `${window.location.origin}` : serverOrigin;

  const points: OverviewPoint[] = [
    {
      icon: 'fa-link',
      term: 'Base URL',
      detail: baseUrl,
    },
    {
      icon: 'fa-key',
      term: 'Authentication',
      detail: 'A personal access token is required for every request.',
    },
    {
      icon: 'fa-book-open',
      term: 'Reference',
      detail: 'Each item describes its parameters and responses.',
    },
  ];

  return (
    <section
      aria-labelledby={WELCOME_HEADING_ID}
      className="p-6 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-2xl animate-fade-in-up motion-reduce:animate-none"
    >
      <header className="flex flex-col gap-1 mb-6">
        <i
          className="fa-solid fa-rocket text-[var(--mount-highlight)] text-2xl"
          aria-hidden="true"
        />
        <h3
          id={WELCOME_HEADING_ID}
          tabIndex={-1}
          className="text-[var(--mount-text)] text-sm font-semibold text-balance"
        >
          Save, read, and delete links programmatically
        </h3>
        <p className="text-[var(--mount-alt-text)] text-xs leading-relaxed text-pretty">
          Here's the short version before you dive in.
        </p>
      </header>

      <dl className="space-y-4">
        {points.map((point) => (
          <div key={point.term} className="flex flex-row items-start gap-3">
            <i
              className={`fa-solid ${point.icon} shrink-0 w-4 py-[3px] text-[var(--mount-text)] text-center text-sm`}
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <dt className="text-[var(--mount-text)] text-sm font-semibold">
                {point.term}
              </dt>
              <dd className="text-[var(--mount-alt-text)] text-xs leading-relaxed text-pretty break-words">
                {point.detail}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
