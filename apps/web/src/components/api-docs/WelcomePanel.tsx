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
  /** Origin requests target; empty string means same-origin as the app. */
  serverOrigin: string;
  /** Whether a user is signed in — tailors the API-key guidance. */
  loggedIn: boolean;
}

interface OverviewPoint {
  icon: string;
  term: string;
  detail: string;
}

export default function WelcomePanel({
  serverOrigin,
  loggedIn,
}: WelcomePanelProps) {
  const baseUrl =
    serverOrigin === '' ? `${window.location.origin}` : serverOrigin;

  // Logged OUT, the page is plain public documentation: no wired-in token, no
  // "try it live". Logged IN, the welcome panel describes the key that's
  // already wired into every form and the live "try it out" affordance.
  const points: OverviewPoint[] = [
    {
      icon: 'fa-link',
      term: 'Base URL',
      detail: baseUrl,
    },
    {
      icon: 'fa-key',
      term: 'Authentication',
      detail: loggedIn
        ? 'Your personal key is already wired into every form below — just hit Send. Real requests use Bearer auth: Authorization: Bearer ltk_…'
        : 'Create a personal access token under Settings → API Tokens, then send it on every request as a Bearer token: Authorization: Bearer ltk_…',
    },
    ...(loggedIn
      ? [
          {
            icon: 'fa-hand-pointer',
            term: 'Try it live',
            detail:
              'Pick an endpoint on the left to read its parameters and responses — then fire a real request right from the page and watch it come back.',
          },
        ]
      : [
          {
            icon: 'fa-book-open',
            term: 'Reference',
            detail:
              'Pick an endpoint on the left to read its full path, parameters, and responses, with a ready-to-copy cURL example for each.',
          },
        ]),
  ];

  return (
    <section
      aria-labelledby={WELCOME_HEADING_ID}
      className="p-5 sm:p-6 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-2xl animate-fade-in-up motion-reduce:animate-none"
    >
      <header className="mb-5">
        <h3
          id={WELCOME_HEADING_ID}
          tabIndex={-1}
          className="flex items-center gap-2 text-[var(--mount-text)] text-lg font-semibold text-balance focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] rounded"
        >
          <i
            className="fa-solid fa-rocket text-[var(--mount-alt-text)] text-sm"
            aria-hidden="true"
          />
          Save, read, and delete links — programmatically
        </h3>
        <p className="mt-1 text-[var(--mount-alt-text)] text-sm leading-relaxed text-pretty">
          Everything you can do in Linklater, your code can do too. Here&rsquo;s
          the short version before you dive in.
        </p>
      </header>

      <dl className="space-y-4">
        {points.map((point) => (
          <div key={point.term} className="flex gap-3">
            <i
              className={`fa-solid ${point.icon} shrink-0 mt-0.5 w-4 text-center text-[var(--mount-alt-text)] text-sm`}
              aria-hidden="true"
            />
            <div>
              <dt className="text-[var(--mount-text)] text-sm font-semibold">
                {point.term}
              </dt>
              <dd className="mt-0.5 text-[var(--mount-alt-text)] text-sm leading-relaxed text-pretty break-words">
                {point.detail}
              </dd>
            </div>
          </div>
        ))}
      </dl>
    </section>
  );
}
