/*
 * Tests for LinkCard – a single saved link rendered as an interactive card.
 *
 * Focus of this file: the "Mark unread" button alignment contract. On a read
 * link (`readAt` set) with no description, the `flex-1` sibling that would
 * otherwise push the button right is absent, so the button must carry
 * `ml-auto` to stay pinned to the right edge. That is the bug this guards.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from 'tailwindcss';
import { describe, expect, it, vi } from 'vitest';
import LinkCard from './index';
import { ThemeProvider } from '../../../theme/ThemeContext';
import type { Link } from '../../../lib/api';
import type { ReactElement } from 'react';

const requireFromHere = createRequire(import.meta.url);
const WEB_SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/**
 * Resolves `@import "tailwindcss";` (and every relative sub-import in
 * index.css) off disk so the compiler registers core variants/utilities AND
 * the app's own `@theme` tokens and `@keyframes`. Mirrors the helper in
 * SettingSwitch.test.tsx, but is pointed at the real index.css so the
 * `--animate-meta-pulse-*` tokens exist during compilation.
 */
function loadStylesheet(id: string, base: string) {
  const path =
    id === 'tailwindcss'
      ? resolve(
          dirname(requireFromHere.resolve('tailwindcss/package.json')),
          'index.css',
        )
      : resolve(base, id);
  return { base: dirname(path), content: readFileSync(path, 'utf8'), path };
}

/** Compiles the app's real index.css plus a set of utility classes. */
async function compileIndexCss(classes: string[]): Promise<string> {
  const indexCss = readFileSync(resolve(WEB_SRC, 'index.css'), 'utf8');
  const compiler = await compile(indexCss, { base: WEB_SRC, loadStylesheet });
  return compiler.build(classes);
}

function renderWithProviders(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: 'link-1',
    url: 'https://example.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    readAt: new Date().toISOString(),
    meta: {
      title: 'Example title',
      description: 'An example description that fills the row.',
      fetchedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe('LinkCard mobile-overflow containment (WCAG 1.4.10 Reflow)', () => {
  // The 320px reflow guard lives on the GRID ITEM, not the card: LinksList adds
  // `min-w-0` to each map wrapper, which resets the grid track's default
  // `min-width: auto` to 0 so a long unbreakable title/URL cannot inflate it
  // past the viewport. That guard is asserted in LinksList.test.tsx. The card
  // wrapper itself must stay `overflow-visible` so its favicon badge (fetched)
  // and the pending badge circle (still loading) can straddle the left accent
  // border; clipping it (`overflow-hidden`) sliced those decorations off, which
  // is the regression these tests guard against. A true scrollWidth check needs
  // a real layout engine (jsdom has none), so the live 320px measurement lives
  // in the PR notes; this asserts the non-clipping class contract as the
  // jsdom-safe oracle.
  it('keeps the card wrapper overflow-visible on a fetched link (favicon can straddle)', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink()} onReadToggle={vi.fn()} />,
    );

    const card = container.firstElementChild;
    expect(card?.className).toContain('overflow-visible');
    expect(card?.className).not.toContain('overflow-hidden');
  });

  it('keeps the card wrapper overflow-visible while metadata is still loading (pending badge circle can straddle)', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const card = container.firstElementChild;
    expect(card?.className).toContain('overflow-visible');
    expect(card?.className).not.toContain('overflow-hidden');
  });
});

describe('LinkCard thumbnail placeholder (local inline SVG, no third party)', () => {
  it('renders the remote OpenGraph image when meta.imageUrl is present', () => {
    const { container } = renderWithProviders(
      <LinkCard
        link={makeLink({
          meta: {
            title: 'Example title',
            imageUrl: 'https://cdn.example.com/og.png',
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const image = container.querySelector(
      'img[src="https://cdn.example.com/og.png"]',
    );
    expect(image).not.toBeNull();
    // With a real image there is no need for the generated placeholder.
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders a locally generated inline-SVG placeholder when there is no imageUrl', () => {
    const { container } = renderWithProviders(
      <LinkCard
        link={makeLink({
          url: 'https://www.example.com/article',
          meta: {
            title: 'Example title',
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    // Decorative: the anchor carries the accessible name, not this thumbnail.
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    // The hostname (without www.) labels the placeholder.
    expect(svg?.textContent).toContain('example.com');
  });

  it('binds the placeholder fills to the mount-highlight CSS vars so it recolors on theme AND mode without JS', () => {
    const { container } = renderWithProviders(
      <LinkCard
        link={makeLink({
          meta: {
            title: 'Example title',
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const svg = container.querySelector('svg');
    const fill = svg?.querySelector('rect')?.getAttribute('fill');
    const textFill = svg?.querySelector('text')?.getAttribute('fill');
    expect(fill).toBe('var(--mount-highlight)');
    expect(textFill).toBe('var(--mount-highlight-fg)');
  });

  it('never references the third-party placeholder host in the rendered card', () => {
    // Host built from parts so this guard does not itself reintroduce the
    // literal into source (the placeholder is fully local now).
    const thirdPartyHost = ['placehold', 'co'].join('.');
    const { container } = renderWithProviders(
      <LinkCard
        link={makeLink({
          meta: {
            title: 'Example title',
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    expect(container.innerHTML).not.toContain(thirdPartyHost);
  });
});

describe('LinkCard thumbnail skeleton (metadata still loading)', () => {
  it('renders the decorative skeleton block while metadata has not been fetched', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const skeleton = container.querySelector(
      'div.bg-\\[var\\(--mount-border\\)\\]',
    );
    expect(skeleton).not.toBeNull();
    expect(skeleton?.getAttribute('aria-hidden')).toBe('true');
    // The fill clears 3:1 on --mount-bg in every theme; a transparent border
    // keeps the block visible as an outline when forced-colors flattens fills.
    expect(skeleton?.className).toContain('border-transparent');
  });
});

describe('LinkCard pending-state pulse (color animation, no opacity flicker)', () => {
  // The old pending indicator was an `animate-pulse` overlay whose translucent
  // `w-1 -translate-x-full` bar sat over the card's opaque left border. At each
  // opacity trough the bar blended with the differently colored layers beneath
  // it, so the left edge flickered between unpredictable seam colors. The fix
  // removes the overlay entirely and animates COLOR instead: the card's own
  // border-color (via the `aria-busy:` variant) and the placeholder badge's
  // background-color. Nothing translucent stacks over the border, so there is
  // nothing left to blend. These guards pin both halves of the fix: the pulse
  // classes are present ONLY while pending, and the flicker mechanism (opacity
  // pulse + stacked bar) is structurally gone, not merely restyled.
  it('drives the pending edge off aria-busy with the color-pulse variants (never border-dashed)', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const card = container.firstElementChild;
    expect(card?.getAttribute('aria-busy')).toBe('true');
    expect(card?.className).not.toContain('border-dashed');
    // Static resting border is --mount-highlight; the aria-busy variant retargets
    // it to --mount-border and runs the border color-pulse while metadata loads.
    expect(card?.className).toContain('border-[var(--mount-highlight)]');
    expect(card?.className).toContain('aria-busy:border-[var(--mount-border)]');
    expect(card?.className).toContain('aria-busy:animate-meta-pulse-border');
  });

  it('removes the opacity-pulse overlay and the stacked left-edge bar', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    // The flicker mechanism itself is gone: no opacity pulse anywhere on the
    // card, and no `-translate-x-full` bar element stacked on the border.
    expect(container.innerHTML).not.toContain('animate-pulse');
    expect(container.innerHTML).not.toContain('-translate-x-full');
  });

  it('renders the placeholder badge as a standalone element that pulses its background color', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const badge = container.querySelector('span.animate-meta-pulse-bg');
    expect(badge).not.toBeNull();
    // The badge ring is now static and opaque (--mount-bg): zero translucency
    // remains in the pending state.
    expect(badge?.className).toContain('ring-2');
    expect(badge?.className).toContain('ring-[var(--mount-bg)]');
  });

  it('carries NONE of the pending pulse once metadata has been fetched', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink()} onReadToggle={vi.fn()} />,
    );

    const card = container.firstElementChild;
    // Reverse of the pending case: no aria-busy attribute (so the aria-busy:
    // variants stay inert), the border-shadow pair is applied, and the pulsing
    // badge element is absent from the DOM entirely.
    expect(card?.getAttribute('aria-busy')).toBeNull();
    expect(card?.className).toContain('border-shadow');
    expect(container.querySelector('.animate-meta-pulse-bg')).toBeNull();
  });

  // jsdom cannot run animations or resolve `@theme` tokens, so a className
  // substring check alone would never prove the utilities compile to the right
  // rules. This compiles the app's real index.css (so the `--animate-meta-pulse-*`
  // tokens and `@keyframes` exist) through the Tailwind pipeline and asserts the
  // resulting CSS, per the project rule to prove variants/utilities via real
  // `compile`, not string matches.
  it('compiles the pending pulse keyframes, tokens, and aria-busy variants', async () => {
    const css = await compileIndexCss([
      'aria-busy:animate-meta-pulse-border',
      'aria-busy:border-[var(--mount-border)]',
      'border-[var(--mount-highlight)]',
      'animate-meta-pulse-bg',
    ]);
    const flattened = css.replace(/\s+/g, ' ');

    // Border keyframe animates border-color between the mount border and
    // highlight endpoints (progressive enhancement on top of the badge).
    expect(flattened).toContain(
      '@keyframes meta-pulse-border { 0%, 100% { border-color: var(--mount-border); } 50% { border-color: var(--mount-highlight); } }',
    );

    // Badge keyframe animates background-color between --mount-bg and
    // --mount-highlight: an in-bundle >=3:1 pair that carries the visible
    // motion in every theme cascade and custom theme.
    expect(flattened).toContain(
      '@keyframes meta-pulse-bg { 0%, 100% { background-color: var(--mount-bg); } 50% { background-color: var(--mount-highlight); } }',
    );

    // Both tokens share the exact same 2s ease-in-out cadence (so border and
    // badge breathe in sync) with NO fill mode (so the reduced-motion clamp
    // rests on the static base classes, not the 50% peak).
    expect(flattened).toContain(
      '--animate-meta-pulse-border: meta-pulse-border 2s ease-in-out infinite;',
    );
    expect(flattened).toContain(
      '--animate-meta-pulse-bg: meta-pulse-bg 2s ease-in-out infinite;',
    );

    // The aria-busy variants compile to rules gated on the aria-busy DOM
    // attribute, so the border retarget and the pulse only apply while pending.
    expect(flattened).toContain(
      '.aria-busy\\:animate-meta-pulse-border[aria-busy="true"] { animation: var(--animate-meta-pulse-border); }',
    );
    expect(flattened).toContain(
      '.aria-busy\\:border-\\[var\\(--mount-border\\)\\][aria-busy="true"] { border-color: var(--mount-border); }',
    );
  });
});

// Every skeleton bar shares one fill token; a span (not the thumbnail div)
// scoped selector picks out just the placeholder bars.
const BAR_SELECTOR = 'span.bg-\\[var\\(--mount-border\\)\\]';

describe('LinkCard loading skeleton (metadata still fetching)', () => {
  it('replaces the title and description with placeholder bars while loading', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const bars = container.querySelectorAll(BAR_SELECTOR);
    // One title bar plus two description bars.
    expect(bars.length).toBe(3);
    bars.forEach((bar) => {
      expect(bar.getAttribute('aria-hidden')).toBe('true');
    });
  });

  it('nests no block element inside a paragraph and adds no loading text or live region', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    expect(container.querySelector('p div')).toBeNull();
    expect(container.textContent).not.toContain('Loading');
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('keeps the hostname as real visible text while loading', () => {
    renderWithProviders(
      <LinkCard
        link={makeLink({ url: 'https://news.example.org/story', meta: null })}
        onReadToggle={vi.fn()}
      />,
    );

    expect(screen.getByText('news.example.org')).toBeInTheDocument();
  });

  it('fills the bars with the mount-border token and never uses orbit-bg anywhere on the loading card', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const bars = container.querySelectorAll(BAR_SELECTOR);
    bars.forEach((bar) => {
      expect(bar.className).toContain('bg-[var(--mount-border)]');
    });
    expect(container.innerHTML).not.toContain('--orbit-bg');
  });

  it('renders the bars as static fills with no shimmer, translate, gradient, or badge pulse', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const bars = container.querySelectorAll(BAR_SELECTOR);
    bars.forEach((bar) => {
      expect(bar.className).not.toMatch(/animate-|translate|gradient/);
    });
  });

  it('outlines each bar with a transparent border for forced-colors', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const bars = container.querySelectorAll(BAR_SELECTOR);
    bars.forEach((bar) => {
      expect(bar.className).toContain('border');
      expect(bar.className).toContain('border-transparent');
    });
  });

  it('sizes bars with fractional widths inside the min-w-0 column, never fixed pixels', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const bars = container.querySelectorAll(BAR_SELECTOR);
    bars.forEach((bar) => {
      expect(bar.className).toMatch(/\bw-(full|\d+\/\d+)\b/);
      expect(bar.className).not.toMatch(/w-\[/);
    });
  });

  it('holds the title bar in a single text-sm line box so the swap shifts no geometry', () => {
    const { container } = renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const titleWrapper = container.querySelector('.h-5');
    expect(titleWrapper).not.toBeNull();
    expect(titleWrapper?.querySelector(BAR_SELECTOR)).not.toBeNull();
  });

  it('keeps the two description bars inside the fixed-height description row', () => {
    const { container } = renderWithProviders(
      <LinkCard
        link={makeLink({ readAt: null, meta: null })}
        onReadToggle={vi.fn()}
      />,
    );

    const row = container.querySelector('.leading-4');
    expect(row?.className).toContain('h-8');
    expect(row?.querySelectorAll(BAR_SELECTOR).length).toBe(2);
  });

  it('keeps the mark-unread button on a read link that is still loading', () => {
    renderWithProviders(
      <LinkCard
        link={makeLink({ readAt: new Date().toISOString(), meta: null })}
        onReadToggle={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', { name: /^Mark unread/ }),
    ).toBeInTheDocument();
  });
});

describe('LinkCard loading accessible name', () => {
  it('names the loading card by site name and says the details are loading', () => {
    renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    expect(
      screen.getByRole('link', {
        name: /^example\.com – loading details, opens in new tab$/,
      }),
    ).toBeInTheDocument();
  });

  it('drops the title slot from the mark-unread label while loading', () => {
    renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const button = screen.getByRole('button', { name: /^Mark unread/ });
    expect(button.getAttribute('aria-label')).toBe('Mark unread – example.com');
  });

  it('keeps the "(No title)" placeholder out of both loading names', () => {
    renderWithProviders(
      <LinkCard link={makeLink({ meta: null })} onReadToggle={vi.fn()} />,
    );

    const anchor = screen.getByRole('link');
    const button = screen.getByRole('button', { name: /^Mark unread/ });
    expect(anchor.getAttribute('aria-label')).not.toContain('(No title)');
    expect(button.getAttribute('aria-label')).not.toContain('(No title)');
  });

  it('treats a link as loading whenever fetchedAt is missing, even with a stale title present', () => {
    const { container } = renderWithProviders(
      <LinkCard
        link={makeLink({
          url: 'https://example.com',
          meta: { title: 'Stale title', fetchedAt: null },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    expect(container.querySelectorAll(BAR_SELECTOR).length).toBe(3);
    expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('true');
    expect(container.textContent).not.toContain('Stale title');
    const anchor = screen.getByRole('link');
    expect(anchor.getAttribute('aria-label')).toMatch(/loading details/);
    expect(anchor.getAttribute('aria-label')).not.toContain('Stale title');
  });

  it('flips the name from loading to the settled shape the render fetchedAt arrives', () => {
    const { rerender } = renderWithProviders(
      <LinkCard
        link={makeLink({ url: 'https://example.com', meta: null })}
        onReadToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole('link').getAttribute('aria-label')).toMatch(
      /loading details/,
    );

    rerender(
      <ThemeProvider>
        <LinkCard
          link={makeLink({
            url: 'https://example.com',
            meta: { title: 'Now loaded', fetchedAt: new Date().toISOString() },
          })}
          onReadToggle={vi.fn()}
        />
      </ThemeProvider>,
    );

    const label = screen.getByRole('link').getAttribute('aria-label');
    expect(label).toBe('Now loaded – example.com, opens in new tab');
    expect(label).not.toMatch(/loading details/);
  });
});

describe('LinkCard loading anchor stays live', () => {
  it('keeps the anchor href, target, and enabled state while a safe link loads', () => {
    renderWithProviders(
      <LinkCard
        link={makeLink({ url: 'https://example.com/article', meta: null })}
        onReadToggle={vi.fn()}
      />,
    );

    const anchor = screen.getByRole('link');
    expect(anchor).toHaveAttribute('href', 'https://example.com/article');
    expect(anchor).toHaveAttribute('target', '_blank');
    expect(anchor).not.toHaveAttribute('aria-disabled');
  });

  it('keeps the same anchor element focused across the loading-to-settled flip', () => {
    const { rerender } = renderWithProviders(
      <LinkCard
        link={makeLink({ url: 'https://example.com', meta: null })}
        onReadToggle={vi.fn()}
      />,
    );

    const anchor = screen.getByRole('link');
    anchor.focus();
    expect(document.activeElement).toBe(anchor);

    rerender(
      <ThemeProvider>
        <LinkCard
          link={makeLink({
            url: 'https://example.com',
            meta: { title: 'Now loaded', fetchedAt: new Date().toISOString() },
          })}
          onReadToggle={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(document.activeElement).toBe(anchor);
    expect(screen.getByRole('link')).toBe(anchor);
  });
});

describe('LinkCard loading safety precedence', () => {
  it('keeps the safety warning instead of a skeleton in the description slot of a loading, unsafe link', () => {
    const { container } = renderWithProviders(
      <LinkCard
        link={makeLink({
          url: 'javascript:alert(1)',
          readAt: null,
          meta: null,
        })}
        onReadToggle={vi.fn()}
      />,
    );

    expect(
      screen.getByText(
        "This link can't be opened – the saved address isn't safe to open.",
      ),
    ).toBeInTheDocument();

    const row = container.querySelector('.leading-4');
    expect(row?.querySelector(BAR_SELECTOR)).toBeNull();

    // The anchor still reads as loading, and as unavailable rather than
    // opening in a new tab.
    expect(screen.getByRole('link').getAttribute('aria-label')).toMatch(
      /loading details, link unavailable/,
    );
  });

  it('drops the empty site name from a loading, unsafe link with no hostname (no leading dash)', () => {
    // `new URL('javascript:...').hostname` is '', so the site-name subject is
    // empty. The loading name must not open on a dangling "– " with no subject.
    renderWithProviders(
      <LinkCard
        link={makeLink({
          url: 'javascript:alert(1)',
          readAt: null,
          meta: null,
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const label = screen.getByRole('link').getAttribute('aria-label');
    expect(label).toBe('loading details, link unavailable');
    expect(label).not.toMatch(/^\s*–/);
  });
});

describe('LinkCard unsafe-URL guard (CWE-79)', () => {
  it('renders a real, safe anchor for a normal http(s) link', () => {
    renderWithProviders(
      <LinkCard
        link={makeLink({ url: 'https://example.com/article' })}
        onReadToggle={vi.fn()}
      />,
    );

    const anchor = screen.getByRole('link', { name: /opens in new tab/ });
    expect(anchor).toHaveAttribute('href', 'https://example.com/article');
    expect(anchor).toHaveAttribute('target', '_blank');
    expect(anchor).toHaveAttribute('rel', 'noreferrer');
    expect(anchor).not.toHaveAttribute('aria-disabled');
  });

  it('never puts a legacy non-http(s) URL in href, and marks the anchor aria-disabled', () => {
    renderWithProviders(
      <LinkCard
        link={makeLink({ url: 'javascript:alert(document.cookie)' })}
        onReadToggle={vi.fn()}
      />,
    );

    const anchor = screen.getByRole('link', { name: /link unavailable/ });
    expect(anchor).toHaveAttribute('href', '#');
    expect(anchor.getAttribute('href')).not.toContain('javascript:');
    expect(anchor).toHaveAttribute('aria-disabled', 'true');
    expect(anchor).not.toHaveAttribute('target');
    expect(anchor).not.toHaveAttribute('rel');
  });

  it('shows a visible explanation and does not mark the link read when the URL is unsafe', () => {
    const onReadToggle = vi.fn();
    renderWithProviders(
      <LinkCard
        link={makeLink({
          url: 'javascript:alert(1)',
          readAt: null,
          meta: { title: 'Example title', fetchedAt: new Date().toISOString() },
        })}
        onReadToggle={onReadToggle}
      />,
    );

    expect(
      screen.getByText(
        "This link can't be opened – the saved address isn't safe to open.",
      ),
    ).toBeInTheDocument();

    const anchor = screen.getByRole('link', { name: /link unavailable/ });
    fireEvent.click(anchor);

    expect(onReadToggle).not.toHaveBeenCalled();
  });
});

describe('LinkCard "Mark unread" alignment', () => {
  it('right-aligns the button on a read link that has NO description', () => {
    // A title with a null description yields a falsy displayDescription, so the
    // `flex-1` sibling is not rendered. The button must carry `ml-auto` to stay
    // pinned to the right edge instead of collapsing left.
    renderWithProviders(
      <LinkCard
        link={makeLink({
          meta: {
            title: 'Example title',
            description: null,
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const button = screen.getByRole('button', { name: /^Mark unread/ });
    expect(button.className).toContain('ml-auto');
  });
});

describe('LinkCard "Mark unread" accessible name (WCAG 2.5.3 Label in Name)', () => {
  it('keeps "Mark unread" as the leading substring so it matches the visible label', () => {
    renderWithProviders(<LinkCard link={makeLink()} onReadToggle={vi.fn()} />);

    const button = screen.getByRole('button', { name: /^Mark unread/ });
    // Visible text on desktop is "Mark unread"; SC 2.5.3 requires the visible
    // label to be a leading substring of the accessible name.
    expect(button.getAttribute('aria-label')).toMatch(/^Mark unread/);
  });

  it('gives two different links two distinct accessible names', () => {
    const { unmount } = renderWithProviders(
      <LinkCard
        link={makeLink({
          url: 'https://example.com',
          meta: {
            title: 'First article',
            description: null,
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const firstLabel = screen
      .getByRole('button', { name: /^Mark unread/ })
      .getAttribute('aria-label');
    expect(firstLabel).toContain('First article');
    expect(firstLabel).toContain('example.com');

    unmount();

    renderWithProviders(
      <LinkCard
        link={makeLink({
          url: 'https://different.org',
          meta: {
            title: 'Second article',
            description: null,
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const secondLabel = screen
      .getByRole('button', { name: /^Mark unread/ })
      .getAttribute('aria-label');
    expect(secondLabel).toContain('Second article');
    expect(secondLabel).toContain('different.org');
    expect(secondLabel).not.toBe(firstLabel);
  });

  it('falls back to both the "(No title)" placeholder and the site name so shared-fallback links still differ', () => {
    renderWithProviders(
      <LinkCard
        link={makeLink({
          url: 'https://news.example.org/story',
          meta: {
            title: undefined,
            description: null,
            fetchedAt: new Date().toISOString(),
          },
        })}
        onReadToggle={vi.fn()}
      />,
    );

    const label = screen
      .getByRole('button', { name: /^Mark unread/ })
      .getAttribute('aria-label');
    // Title is unknown, but the site name still disambiguates from another
    // "(No title)" link on a different host.
    expect(label).toContain('(No title)');
    expect(label).toContain('news.example.org');
  });
});
