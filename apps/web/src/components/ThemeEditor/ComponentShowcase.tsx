import { useState } from 'react';
import type { ReactNode } from 'react';
import Alert from '../ui/Alert';
import FormInput from '../ui/FormInput';
import IconButton from '../ui/IconButton';
import PrimaryButton from '../ui/PrimaryButton';
import TabButton from '../ui/TabButton';

function ShowcaseSection({
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

const SURFACE_ITEMS = [
  { label: 'Background', variable: '--bg' },
  { label: 'Surface', variable: '--bg-surface' },
  { label: 'Elevated', variable: '--bg-elevated' },
  { label: 'Input', variable: '--bg-input' },
] as const;

export default function ComponentShowcase() {
  const [activeTab, setActiveTab] = useState<'unread' | 'read'>('unread');

  return (
    <div className="space-y-6">
      <ShowcaseSection title="Surfaces">
        <div className="grid grid-cols-2 gap-2">
          {SURFACE_ITEMS.map(({ label, variable }) => (
            <div
              key={variable}
              className="px-3 py-2.5 border border-[var(--border)] rounded-lg"
              style={{ backgroundColor: `var(${variable})` }}
            >
              <p className="text-[var(--text)] text-xs font-medium">{label}</p>
              <p className="text-[var(--text-subtle)] text-[0.65rem] font-mono">{variable}</p>
            </div>
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Typography">
        <div className="space-y-1.5 px-3 py-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg">
          <p className="text-[var(--text)] text-sm font-semibold">Primary text</p>
          <p className="text-[var(--text-muted)] text-sm">Muted — labels and captions</p>
          <p className="text-[var(--text-subtle)] text-sm">Subtle — hints and URLs</p>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Buttons">
        <div className="flex flex-wrap gap-2">
          <PrimaryButton type="button">
            <i className="fa-solid fa-plus text-xs" aria-hidden="true" />
            Add link
          </PrimaryButton>
          <IconButton variant="elevated">
            <i className="fa-solid fa-shuffle text-[0.7rem]" aria-hidden="true" />
            Stumble upon
          </IconButton>
          <IconButton variant="default">
            <i className="fa-solid fa-bookmark text-[0.7rem]" aria-hidden="true" />
            Default
          </IconButton>
          <IconButton variant="ghost">
            <i className="fa-solid fa-ellipsis text-[0.7rem]" aria-hidden="true" />
            Ghost
          </IconButton>
          <IconButton variant="danger">
            <i className="fa-solid fa-triangle-exclamation text-[0.7rem]" aria-hidden="true" />
            Danger
          </IconButton>
          <IconButton variant="danger-filled">
            <i className="fa-solid fa-trash text-[0.7rem]" aria-hidden="true" />
            Danger filled
          </IconButton>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Form input">
        <FormInput type="text" placeholder="Paste a URL to save…" readOnly />
      </ShowcaseSection>

      <ShowcaseSection title="Tabs">
        <div
          className="relative inline-flex p-1 bg-[var(--bg-surface)] shadow-sm text-xs rounded-full"
          role="tablist"
          aria-label="Tab example"
        >
          <div
            aria-hidden="true"
            className={`absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-[var(--text)] transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
              activeTab === 'read' ? 'translate-x-full' : ''
            }`}
          />
          <TabButton
            className="px-3 py-1.5"
            isActive={activeTab === 'unread'}
            onClick={() => setActiveTab('unread')}
          >
            Unread
          </TabButton>
          <TabButton
            className="px-3 py-1.5"
            isActive={activeTab === 'read'}
            onClick={() => setActiveTab('read')}
          >
            Read
          </TabButton>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Alerts">
        <div className="space-y-2">
          <Alert variant="error">Something went wrong. Please try again.</Alert>
          <Alert variant="success">Changes saved successfully.</Alert>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Card">
        <div className="p-4 bg-[var(--bg-surface)] border border-[var(--border)] border-l-2 border-l-[var(--accent)] rounded-xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-[var(--bg-elevated)] rounded-md">
              <i
                className="fa-solid fa-link text-[var(--text-subtle)] text-[0.7rem]"
                aria-hidden="true"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[var(--text)] text-sm font-medium truncate">
                Example saved link
              </p>
              <p className="text-[var(--text-subtle)] text-xs truncate">example.com</p>
            </div>
          </div>
          <p className="mt-2 text-[var(--text-muted)] text-xs line-clamp-2">
            A brief description of the saved link. This shows how muted text looks within a
            card surface in the current theme.
          </p>
        </div>
      </ShowcaseSection>

      <ShowcaseSection title="Accent">
        <div className="flex items-center gap-3">
          <div className="flex-1 px-3 py-2.5 bg-[var(--accent)] rounded-lg">
            <p className="text-[var(--accent-fg)] text-xs font-semibold">Accent surface</p>
            <p className="text-[var(--accent-fg)] text-[0.65rem] opacity-75">
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
