import ShowcaseSection from './ShowcaseSection';
import { BUNDLES } from './useThemeOverrides';
import { useState } from 'react';
import Alert from '../../common/Alert';
import FormInput from '../../common/FormInput';
import IconButton from '../../common/IconButton';
import PrimaryButton from '../../common/PrimaryButton';

const BUNDLE_DEMO_TEXT: Record<(typeof BUNDLES)[number], string> = {
  base: 'Page chrome',
  mount: 'Card surface',
  orbit: 'Menu surface',
  alert: 'Error / danger',
  warn: 'Warning banner',
  info: 'Tip or hint',
  success: 'Verified, confirmed',
};

/**
 * A read-only preview panel showing all major UI components styled with the
 * current theme. Used in the theme editor so changes to bundle tokens are
 * immediately visible in realistic context.
 *
 * The tab switcher in this showcase is interactive (controlled by local
 * state) so users can verify that active/inactive tab styles look correct.
 */
export default function ComponentShowcase() {
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread');

  return (
    <div className="space-y-6">
      <ShowcaseSection title="Bundles">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {BUNDLES.map((bundle) => (
            <article
              key={bundle}
              aria-label={`${bundle} bundle preview`}
              className="px-3 py-2.5 border rounded-lg"
              style={{
                backgroundColor: `var(--${bundle}-bg)`,
                borderColor: `var(--${bundle}-border)`,
              }}
            >
              <h4
                className="text-[0.65rem] uppercase tracking-wide font-semibold"
                style={{ color: `var(--${bundle}-text)` }}
              >
                {bundle}
              </h4>
              <p
                className="text-[0.7rem]"
                style={{ color: `var(--${bundle}-text)` }}
              >
                {BUNDLE_DEMO_TEXT[bundle]}
              </p>
              <p
                className="text-[0.6rem]"
                style={{ color: `var(--${bundle}-alt-text)` }}
              >
                Alt text sample
              </p>
              <div className="mt-1.5 inline-flex items-center px-1.5 py-0.5 text-[0.6rem] font-semibold rounded">
                <span
                  style={{
                    backgroundColor: `var(--${bundle}-highlight)`,
                    color: `var(--${bundle}-highlight-fg)`,
                  }}
                  className="px-1.5 py-0.5 rounded"
                >
                  Highlight
                </span>
              </div>
            </article>
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Typography">
        <div className="space-y-2">
          <div className="space-y-1.5 px-3 py-3 bg-[var(--mount-bg)] border border-[var(--mount-border)] rounded-lg">
            <p className="text-[var(--mount-text)] text-sm font-semibold">
              Card primary
            </p>
            <p className="text-[var(--mount-alt-text)] text-sm">
              Card alt — labels, captions, helper hints
            </p>
          </div>
          {/* Base-only subtle-text tier is rendered against the page surface,
              not the card, because its 4.5:1 contract targets --base-bg. */}
          <div className="space-y-1.5 px-3 py-3 bg-[var(--base-bg)] border border-[var(--base-border)] rounded-lg">
            <p className="text-[var(--base-text)] text-sm font-semibold">
              Page primary
            </p>
            <p className="text-[var(--base-alt-text)] text-sm">
              Page alt — section nav, descriptions
            </p>
            <p className="text-[var(--base-subtle-text)] text-sm">
              Page subtle — kbd legends, chevrons, hints
            </p>
          </div>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Buttons">
        <div className="flex flex-wrap gap-2">
          <PrimaryButton type="button">
            <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
            Add link
          </PrimaryButton>
          <IconButton variant="elevated">
            <i
              className="fa-brands fa-stumbleupon text-[0.7rem]"
              aria-hidden="true"
            />
            Stumble!
          </IconButton>
          <IconButton>
            <i
              className="fa-solid fa-bookmark text-[0.7rem]"
              aria-hidden="true"
            />
            Default
          </IconButton>
          <IconButton variant="ghost">
            <i
              className="fa-solid fa-ellipsis text-[0.7rem]"
              aria-hidden="true"
            />
            Ghost
          </IconButton>
          <IconButton variant="danger">
            <i
              className="fa-solid fa-triangle-exclamation text-[0.7rem]"
              aria-hidden="true"
            />
            Danger
          </IconButton>
          <IconButton variant="danger-filled">
            <i className="fa-solid fa-trash text-[0.7rem]" aria-hidden="true" />
            Danger filled
          </IconButton>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Form input">
        <FormInput
          surface="mount"
          type="text"
          placeholder="Paste a URL to save…"
          aria-label="Demo URL input"
          readOnly
        />
      </ShowcaseSection>

      <ShowcaseSection title="Tabs">
        {/* read-only style preview, not a real tab widget — plain buttons
            (no role="tab"/"tablist") so we don't advertise a tablist that
            controls no panel. mirrors TabButton's active style + circle-dot
            indicator + no-width-shift grid via aria-pressed. */}
        <div className="relative grid grid-cols-2 p-1 bg-[var(--mount-bg)] border-shadow hover:border-shadow text-xs rounded-full">
          <div
            aria-hidden="true"
            className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] bg-[var(--mount-text)] rounded-full"
            style={{
              transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1)',
              transform:
                activeTab === 'read' ? 'translateX(100%)' : 'translateX(0)',
            }}
          />
          {(['unread', 'read'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={activeTab === tab}
              onClick={() => setActiveTab(tab)}
              className="group relative z-10 px-3 py-1.5 text-[var(--mount-alt-text)] font-semibold aria-pressed:text-[var(--mount-bg)] aria-pressed:font-extrabold rounded-full transition-colors duration-200 cursor-pointer"
            >
              <span className="grid justify-center">
                <span
                  className="col-start-1 row-start-1 invisible flex items-center justify-center gap-1 font-extrabold"
                  aria-hidden="true"
                >
                  <i
                    className="fa-solid fa-circle-dot text-[0.4rem]"
                    aria-hidden="true"
                  />
                  {tab === 'unread' ? 'Unread' : 'Read'}
                </span>
                <span className="col-start-1 row-start-1 flex items-center justify-center gap-1">
                  <i
                    className="hidden group-aria-pressed:inline fa-solid fa-circle-dot text-[0.4rem]"
                    aria-hidden="true"
                  />
                  {tab === 'unread' ? 'Unread' : 'Read'}
                </span>
              </span>
            </button>
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Alerts">
        <div className="space-y-2">
          <Alert variant="error">Something went wrong. Please try again.</Alert>
          <Alert variant="success">Changes saved successfully.</Alert>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Card">
        <div className="p-4 bg-[var(--mount-bg)] border border-[var(--mount-border)] border-l-2 border-l-[var(--mount-highlight)] rounded-xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-[var(--orbit-bg)] rounded-md">
              <i
                className="fa-solid fa-link text-[var(--orbit-alt-text)] text-[0.7rem]"
                aria-hidden="true"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[var(--mount-text)] text-sm font-medium truncate">
                Example saved link
              </p>
              <p className="text-[var(--mount-alt-text)] text-xs truncate">
                example.com
              </p>
            </div>
          </div>
          <p className="mt-2 text-[var(--mount-alt-text)] text-xs line-clamp-2">
            A brief description of the saved link. This shows how muted text
            looks within a card surface in the current theme.
          </p>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Accent">
        <div className="flex items-center gap-3">
          <div className="flex-1 px-3 py-2.5 bg-[var(--accent)] rounded-lg">
            <p className="text-[var(--accent-fg)] text-xs font-semibold">
              Accent surface
            </p>
            <p className="text-[var(--accent-fg)] text-[0.65rem]">
              --accent-fg on --accent
            </p>
          </div>
          <div
            className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <i
              className="fa-solid fa-palette text-[var(--accent-fg)] text-sm"
              aria-hidden="true"
            />
          </div>
        </div>
      </ShowcaseSection>
    </div>
  );
}
