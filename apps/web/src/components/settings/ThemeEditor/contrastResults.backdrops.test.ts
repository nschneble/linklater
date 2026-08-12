/*
 * Holds the backdrop table to its derivation, as far as a suite can.
 *
 * The table claims to be walked from real render sites rather than reasoned
 * out from token names, and before this file nothing checked that. Five of its
 * seven rows were wrong on arrival: a chain nothing renders, a chain missing
 * its real host, an "only ever inside a card" claim contradicted by the
 * editor's own preview. Worst-of scoring means an invented chain does not sit
 * inert, it becomes the number the user reads.
 *
 * What the gates below check:
 *   1. the table matches the chains the cited sites derive, so dropping a
 *      chain from one side without the other fails
 *   2. every cited file really paints the layer it is cited for, so a citation
 *      cannot be decorative
 *   3. the set of files painting a bundle surface is frozen, so a new consumer
 *      forces someone to walk its ancestors before the suite goes green
 *   4. a file that swaps one background for another on a single element is not
 *      citing a layer, since the declaration that wins replaces the other
 *
 * What they do NOT check, said plainly because a comment claiming a property
 * the suite lacks is worse than no comment: that a cited host is an ANCESTOR
 * of the surface. Gate 2 asks whether a class appears in a file, not how the
 * two nest. Gate 1 compares two hand-written literals written from the same
 * walk, so a chain invented consistently on both sides passes. Gate 3 freezes
 * files rather than chains, so a new chain between two files that already
 * paint is invisible to it. Real ancestry would mean resolving composition
 * through children props, which these render trees lean on everywhere and
 * which no cheap check can follow, so the walk stays a human step. Two of the
 * entries here were wrong for exactly that reason: both named a painter that
 * exists, in a position it never occupies.
 */

import { basename, dirname, join, relative, resolve } from 'node:path';
import {
  BUNDLE_BACKDROPS,
  HIGHLIGHT_BACKDROPS,
} from './contrastResults.backdrops';
import { BUNDLES, type Bundle } from './useThemeOverrides';
import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';

const WEB_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);
const SOURCE_ROOT = join(WEB_ROOT, 'src');

/**
 * One place a bundle surface renders: the chain of backdrops beneath it, the
 * file that paints the surface, and one file per chain layer that paints that
 * layer. Naming a file per layer is what makes the chain checkable; a chain
 * with no citation is an assertion nobody can follow.
 */
interface RenderSite {
  chain: readonly string[];
  surface: string;
  hosts: readonly string[];
}

const APP_SHELL = 'AppShell.tsx';
const SETTINGS_GROUP = 'components/settings/SettingsGroup.tsx';
const SHOWCASE = 'components/settings/ThemeEditor/ComponentShowcase.tsx';
const ALERT = 'components/common/Alert.tsx';
const ICON_BUTTON = 'components/common/IconButton.tsx';
const MOCK_BANNER = 'components/settings/ThemeEditor/MockBanner.tsx';
const MOCK_TOAST = 'components/settings/ThemeEditor/MockToast.tsx';
const PRIMARY_BUTTON = 'components/common/PrimaryButton.tsx';
const SWITCH = 'components/settings/SettingSwitch.tsx';
const TOAST = 'components/common/Toast.tsx';
const TOKEN_ROW = 'components/settings/ApiTokensList/ApiTokenRow.tsx';

/** Where each bundle's `-bg` renders, with the walk that found it. */
const SURFACE_SITES: Record<Bundle, readonly RenderSite[]> = {
  base: [
    { chain: [], surface: APP_SHELL, hosts: [] },
    {
      chain: ['--base-bg'],
      surface: 'components/links/LinksView.tsx',
      hosts: [APP_SHELL],
    },
  ],
  mount: [
    { chain: ['--base-bg'], surface: SETTINGS_GROUP, hosts: [APP_SHELL] },
    {
      chain: ['--mount-bg', '--base-bg'],
      surface: 'components/settings/ThemeEditor/BundleTabs.tsx',
      hosts: ['components/settings/ThemeEditor/index.tsx', APP_SHELL],
    },
  ],
  orbit: [
    {
      chain: ['--base-bg'],
      surface: 'components/Header.tsx',
      hosts: [APP_SHELL],
    },
    {
      chain: ['--mount-bg', '--base-bg'],
      surface: SWITCH,
      hosts: [SETTINGS_GROUP, APP_SHELL],
    },
    {
      chain: ['--orbit-bg', '--base-bg'],
      surface: 'components/UserMenu/index.tsx',
      hosts: ['components/Header.tsx', APP_SHELL],
    },
  ],
  alert: [
    { chain: ['--base-bg'], surface: SETTINGS_GROUP, hosts: [APP_SHELL] },
    {
      chain: ['--mount-bg', '--base-bg'],
      surface: ALERT,
      hosts: [SETTINGS_GROUP, APP_SHELL],
    },
    {
      chain: ['--alert-bg', '--base-bg'],
      surface: ALERT,
      hosts: [SETTINGS_GROUP, APP_SHELL],
    },
    {
      chain: ['--orbit-bg', '--mount-bg', '--base-bg'],
      surface: ALERT,
      hosts: [TOKEN_ROW, SETTINGS_GROUP, APP_SHELL],
    },
  ],
  warn: [
    { chain: ['--base-bg'], surface: APP_SHELL, hosts: [APP_SHELL] },
    {
      chain: ['--mount-bg', '--base-bg'],
      surface: 'components/common/StatusBadge.tsx',
      hosts: [SETTINGS_GROUP, APP_SHELL],
    },
  ],
  info: [
    { chain: ['--base-bg'], surface: MOCK_BANNER, hosts: [SHOWCASE] },
    {
      chain: ['--mount-bg', '--base-bg'],
      surface: 'components/common/StatusBadge.tsx',
      hosts: [SETTINGS_GROUP, APP_SHELL],
    },
  ],
  success: [
    { chain: ['--base-bg'], surface: MOCK_BANNER, hosts: [SHOWCASE] },
    {
      chain: ['--mount-bg', '--base-bg'],
      surface: ALERT,
      hosts: [SETTINGS_GROUP, APP_SHELL],
    },
    {
      chain: ['--alert-bg', '--base-bg'],
      surface: ALERT,
      hosts: [SETTINGS_GROUP, APP_SHELL],
    },
  ],
};

/** Where each bundle's highlight FILL renders. */
const HIGHLIGHT_SITES: Record<Bundle, readonly RenderSite[]> = {
  base: [
    {
      chain: ['--base-bg'],
      surface: 'components/settings/ThemeEditor/MockToolbar.tsx',
      hosts: [SHOWCASE],
    },
  ],
  mount: [
    {
      chain: ['--mount-bg', '--base-bg'],
      surface: 'components/settings/ThemeEditor/MockLinkCard.tsx',
      hosts: ['components/settings/ThemeEditor/MockLinkCard.tsx', SHOWCASE],
    },
    // the account-deletion submit button asks for no host, so it
    // fills from the default chrome tier while on the danger card
    {
      chain: ['--alert-bg', '--base-bg'],
      surface: PRIMARY_BUTTON,
      hosts: [SETTINGS_GROUP, APP_SHELL],
    },
  ],
  orbit: [
    {
      chain: ['--orbit-bg', '--base-bg'],
      surface: 'components/settings/ThemeEditor/MockHeader.tsx',
      hosts: ['components/settings/ThemeEditor/MockHeader.tsx', SHOWCASE],
    },
    // the switch swaps its own background on the checked variant
    // rather than layering, so its backdrop is the card it sits in
    {
      chain: ['--mount-bg', '--base-bg'],
      surface: SWITCH,
      hosts: [SETTINGS_GROUP, APP_SHELL],
    },
  ],
  alert: [
    { chain: ['--base-bg'], surface: TOAST, hosts: [APP_SHELL] },
    {
      chain: ['--mount-bg', '--base-bg'],
      surface: ICON_BUTTON,
      hosts: [SETTINGS_GROUP, APP_SHELL],
    },
    {
      chain: ['--alert-bg', '--base-bg'],
      surface: ICON_BUTTON,
      hosts: [SETTINGS_GROUP, APP_SHELL],
    },
    {
      chain: ['--orbit-bg', '--mount-bg', '--base-bg'],
      surface: ICON_BUTTON,
      hosts: [TOKEN_ROW, SETTINGS_GROUP, APP_SHELL],
    },
  ],
  warn: [{ chain: ['--base-bg'], surface: TOAST, hosts: [APP_SHELL] }],
  info: [{ chain: ['--base-bg'], surface: MOCK_TOAST, hosts: [SHOWCASE] }],
  success: [{ chain: ['--base-bg'], surface: TOAST, hosts: [APP_SHELL] }],
};

/*
 * Every file that paints a bundle background, and which bundles it paints as a
 * surface and as a highlight fill. Frozen: a new consumer, or an old one that
 * starts painting another bundle, fails here by name so its render stack gets
 * walked before the table is trusted again.
 *
 * The two known-dead mocks (MockNotice, MockMenu, orphaned when the showcase
 * split into per-element mocks) are absent because nothing imports them, which
 * the discovery below applies as a rule rather than an exception list.
 */
const PAINTERS: ReadonlyArray<readonly [string, string, string]> = [
  ['App.tsx', 'base', ''],
  ['AppShell.tsx', 'base mount warn', ''],
  ['components/FailWhalePage/index.tsx', 'base mount', ''],
  ['components/Header.tsx', 'orbit', ''],
  ['components/LandingPage/FeaturesSection.tsx', 'mount', ''],
  ['components/LandingPage/HeroSection.tsx', 'mount', 'base'],
  ['components/LandingPage/index.tsx', '', 'base'],
  ['components/UserMenu/MenuItem.tsx', '', 'orbit'],
  ['components/UserMenu/MobileBottomSheet.tsx', 'orbit', ''],
  ['components/UserMenu/ThemeSubmenu.tsx', 'orbit', 'orbit'],
  ['components/UserMenu/index.tsx', 'orbit', ''],
  ['components/api-docs/ApiDocsView.tsx', '', 'base'],
  ['components/api-docs/ApiReference.tsx', 'mount', ''],
  ['components/api-docs/EndpointDetail.tsx', 'mount', ''],
  ['components/api-docs/EndpointNav.tsx', 'orbit', ''],
  ['components/api-docs/EndpointNavCompact.tsx', 'base orbit', ''],
  ['components/api-docs/ResponseTabs.tsx', 'orbit', ''],
  ['components/api-docs/WelcomePanel.tsx', 'mount', ''],
  ['components/auth/AlreadySignedInNotice.tsx', 'mount', ''],
  ['components/auth/AuthCard.tsx', 'mount', ''],
  ['components/auth/ConfirmAccountDeletionPage.tsx', 'base', ''],
  ['components/auth/ExtensionAuthorizePage.tsx', 'mount', 'mount'],
  ['components/auth/OAuthCallbackPage.tsx', 'base', ''],
  ['components/auth/ResetPasswordPage.tsx', 'base mount', ''],
  ['components/auth/VerifyLoginPage.tsx', 'base', ''],
  ['components/common/Alert.tsx', 'alert success', ''],
  ['components/common/CopyRevealPanel.tsx', 'orbit', ''],
  ['components/common/IconButton.tsx', 'mount orbit alert', 'alert'],
  ['components/common/IconListButton.tsx', 'mount orbit', ''],
  ['components/common/Modal.tsx', 'orbit', ''],
  ['components/common/PendingNoticeAnnouncer.tsx', 'mount', ''],
  ['components/common/PrimaryButton.tsx', '', 'base mount orbit'],
  ['components/common/SlidingTabBar.tsx', 'mount orbit', ''],
  ['components/common/StatusBadge.tsx', 'warn info success', ''],
  ['components/common/Toast.tsx', '', 'alert warn success'],
  ['components/errors/ErrorBoundary.tsx', 'base', ''],
  ['components/errors/NotFoundView.tsx', 'base', ''],
  ['components/legal/PolicyDocumentPage.tsx', '', 'base'],
  ['components/links/KeyboardShortcutsModal.tsx', 'orbit', ''],
  ['components/links/LinkCardLayout.tsx', 'mount', 'mount'],
  ['components/links/LinksView.tsx', 'base', ''],
  ['components/links/SuggestionCallout.tsx', 'mount', ''],
  ['components/settings/ApiTokensList/ApiTokenRow.tsx', 'orbit', ''],
  ['components/settings/BookmarkletSection.tsx', 'mount orbit', ''],
  ['components/settings/SettingSwitch.tsx', 'orbit', 'orbit'],
  ['components/settings/SettingsGroup.tsx', 'mount alert', ''],
  ['components/settings/SettingsLayout.tsx', 'mount', ''],
  ['components/settings/SettingsSectionNav.tsx', 'base orbit', ''],
  ['components/settings/ThemeEditor/BundleTabs.tsx', 'mount', ''],
  ['components/settings/ThemeEditor/ComponentShowcase.tsx', 'base', ''],
  [
    'components/settings/ThemeEditor/MockBanner.tsx',
    'base mount orbit alert warn info success',
    '',
  ],
  ['components/settings/ThemeEditor/MockHeader.tsx', 'orbit', 'orbit'],
  ['components/settings/ThemeEditor/MockLinkCard.tsx', 'mount', 'mount'],
  [
    'components/settings/ThemeEditor/MockToast.tsx',
    '',
    'base mount orbit alert warn info success',
  ],
  ['components/settings/ThemeEditor/MockToolbar.tsx', 'mount', 'base'],
  ['components/settings/ThemeEditor/index.tsx', 'mount', ''],
  ['components/settings/TotpSetupView.tsx', 'orbit', ''],
  ['components/stumble/StumbleEmptyView.tsx', 'base', ''],
  ['components/stumble/StumblePage.tsx', 'base', ''],
  ['components/stumble/StumbleSection.tsx', 'mount orbit', ''],
  ['components/verify/TokenVerificationPage.tsx', 'base', ''],
  ['components/welcome/WelcomeModal.tsx', 'orbit', ''],
  ['routes/Common.tsx', 'base', ''],
];

// the two mocks that take their bundle as a prop paint every bundle at once
const DYNAMIC_BG = 'backgroundColor: `var(--${bundle}-bg)`';
const DYNAMIC_HIGHLIGHT = 'backgroundColor: `var(--${bundle}-highlight)`';

function sourcePaths(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) return sourcePaths(full);
    if (!/\.tsx?$/.test(entry.name)) return [];
    if (/\.(test|spec)\./.test(entry.name)) return [];
    return [full];
  });
}

const SOURCES = new Map(
  sourcePaths(SOURCE_ROOT).map((full) => [
    relative(SOURCE_ROOT, full),
    readFileSync(full, 'utf8'),
  ]),
);

/**
 * Module specifiers imported anywhere in `src`, by final path segment. A file
 * nobody imports renders nowhere, so it is not a render site no matter what it
 * paints; treating that as a rule keeps dead mocks out without an exception
 * list that would also hide a live one.
 */
const IMPORTED = new Set(
  [...SOURCES.values()].flatMap((source) =>
    [...source.matchAll(/from '([^']+)'|import\(\s*'([^']+)'/g)].map((match) =>
      (match[1] ?? match[2])
        .split('/')
        .pop()!
        .replace(/\.tsx?$/, ''),
    ),
  ),
);

function isReachable(path: string): boolean {
  const stem = basename(path).replace(/\.tsx?$/, '');
  return IMPORTED.has(stem === 'index' ? basename(dirname(path)) : stem);
}

/*
 * A background paint, with whatever variant prefix gates it. Class strings in
 * this codebase are written one element per line, so a line stands in for an
 * element; the alternative is parsing JSX to find the real boundaries.
 *
 * Gate 4 rests entirely on that stand-in, and it holds for one string
 * literal per element and no further. A class string assembled from
 * parts spreads one element's paints across the lines the parts are
 * written on, so a swap this gate would catch inside a single literal
 * reads as two elements and passes. Closing it means finding the real
 * element boundaries.
 */
const BACKGROUND_PAINT = /(\S*?)bg-\[var\((--[a-z-]+)\)\]/g;

/**
 * Per background token, the tokens the same element paints UNGATED beneath it.
 * A variant that swaps the background of an element does not layer over what
 * was there: the winning declaration replaces it, so the idle background is
 * not a backdrop of the state background and cannot be cited as one.
 */
function replacedBackgrounds(path: string): Map<string, Set<string>> {
  const replaced = new Map<string, Set<string>>();
  for (const line of (SOURCES.get(path) ?? '').split('\n')) {
    const painted = [...line.matchAll(BACKGROUND_PAINT)];
    const ungated = painted.filter(([, prefix]) => !prefix.endsWith(':'));
    for (const [, prefix, token] of painted) {
      if (!prefix.endsWith(':')) continue;
      const beneath = replaced.get(token) ?? new Set<string>();
      for (const [, , idle] of ungated) beneath.add(idle);
      replaced.set(token, beneath);
    }
  }
  return replaced;
}

/**
 * The bundles the toast mock renders desaturated, read out of its own source
 * so the exclusion resting on that muting cannot outlive it. Throws rather
 * than returning nothing when the declaration changes shape, since a silent
 * empty answer would pass every assertion below.
 */
function mutedToastBundles(): Bundle[] {
  const declared = (SOURCES.get(MOCK_TOAST) ?? '').match(
    /new Set<Bundle>\(\[([^\]]*)\]\)/,
  );
  if (declared === null) {
    throw new Error(`No muted-bundle declaration found in ${MOCK_TOAST}`);
  }
  return BUNDLES.filter((bundle) => declared[1].includes(`'${bundle}'`));
}

function paints(path: string, token: string): boolean {
  const source = SOURCES.get(path);
  if (source === undefined) return false;
  if (source.includes(`bg-[var(${token})]`)) return true;
  if (token.endsWith('-bg')) return source.includes(DYNAMIC_BG);
  return source.includes(DYNAMIC_HIGHLIGHT);
}

/** Bundles whose `-bg` (or highlight fill) `path` paints, from source alone. */
function paintedBundles(path: string, slot: 'bg' | 'highlight'): Bundle[] {
  return BUNDLES.filter((bundle) => {
    if (slot === 'bg') return paints(path, `--${bundle}-bg`);
    return (
      paints(path, `--${bundle}-highlight`) ||
      paints(path, `--${bundle}-highlight-hover`)
    );
  });
}

function chainKeys(sites: readonly RenderSite[]): string[] {
  return [...new Set(sites.map((site) => site.chain.join(' > ')))].sort();
}

function tableKeys(chains: readonly (readonly string[])[]): string[] {
  return [...new Set(chains.map((chain) => chain.join(' > ')))].sort();
}

describe('the backdrop table is exactly what its render sites derive', () => {
  it.each(BUNDLES)('%s surfaces', (bundle) => {
    expect(tableKeys(BUNDLE_BACKDROPS[bundle])).toEqual(
      chainKeys(SURFACE_SITES[bundle]),
    );
  });

  it.each(BUNDLES)('%s highlight fills', (bundle) => {
    expect(tableKeys(HIGHLIGHT_BACKDROPS[bundle])).toEqual(
      chainKeys(HIGHLIGHT_SITES[bundle]),
    );
  });
});

describe('every cited render site paints what it is cited for', () => {
  const cases = BUNDLES.flatMap((bundle) => [
    ...SURFACE_SITES[bundle].map((site) => ({ bundle, site, slot: 'bg' })),
    ...HIGHLIGHT_SITES[bundle].map((site) => ({
      bundle,
      site,
      slot: 'highlight',
    })),
  ]);

  it.each(cases)('$bundle $slot on [$site.chain]', ({ bundle, site, slot }) => {
    expect(paints(site.surface, `--${bundle}-${slot}`)).toBe(true);
    expect(site.hosts).toHaveLength(site.chain.length);
    site.chain.forEach((token, index) => {
      expect(paints(site.hosts[index], token)).toBe(true);
    });
  });
});

describe('a background replaced on one element is not a layer beneath it', () => {
  /*
   * Only a site that cites its OWN file as a host can make this mistake: any
   * other host paints on a different element by construction. Both real
   * self-hosted sites are mocks whose wrapper and accent are separate
   * elements, which is what a genuine layer looks like.
   */
  const selfHosted = BUNDLES.flatMap((bundle) =>
    [
      ...SURFACE_SITES[bundle].map((site) => ({ site, slot: 'bg' })),
      ...HIGHLIGHT_SITES[bundle].map((site) => ({ site, slot: 'highlight' })),
    ].flatMap(({ site, slot }) =>
      site.hosts.flatMap((host, index) =>
        host === site.surface
          ? [{ bundle, slot, host, layer: site.chain[index] }]
          : [],
      ),
    ),
  );

  it('cites no layer that its own surface paints over on one element', () => {
    const invented = selfHosted
      .filter(({ bundle, slot, host, layer }) => {
        const replaced = replacedBackgrounds(host);
        const painted =
          slot === 'highlight'
            ? [`--${bundle}-highlight`, `--${bundle}-highlight-hover`]
            : [`--${bundle}-bg`];
        return painted.some(
          (token) => replaced.get(token)?.has(layer) ?? false,
        );
      })
      .map(({ bundle, slot, layer }) => `${bundle} ${slot} over ${layer}`);

    expect(invented).toEqual([]);
  });

  it('reads the settings switch as replacing its own background', () => {
    // the shape that made the old orbit citation wrong. Were the
    // switch to stop replacing, its highlight would gain a layer and
    // the orbit row of the table would have to be walked again
    expect(replacedBackgrounds(SWITCH).get('--orbit-highlight')).toEqual(
      new Set(['--orbit-bg']),
    );
  });
});

describe('the muted mock renders no bundle it is cited for', () => {
  it('cites the toast mock for no bundle it draws desaturated', () => {
    const cited = mutedToastBundles().filter((bundle) =>
      HIGHLIGHT_SITES[bundle].some((site) => site.surface === MOCK_TOAST),
    );

    expect(cited).toEqual([]);
  });

  it('finds no hover un-mute on the toast mock', () => {
    // its three sibling mocks un-mute on hover. Adding that one line
    // here, which a reviewer would encourage for consistency, makes
    // the desaturated bundles live and owes each of them a chain
    expect(SOURCES.get(MOCK_TOAST)).not.toContain('group-hover:');
  });
});

describe('no bundle surface is painted outside the frozen consumer set', () => {
  const discovered = [...SOURCES.keys()]
    .filter(isReachable)
    .map(
      (path) =>
        [
          path,
          paintedBundles(path, 'bg').join(' '),
          paintedBundles(path, 'highlight').join(' '),
        ] as const,
    )
    .filter(([, bgs, highlights]) => bgs !== '' || highlights !== '')
    .sort(([first], [second]) => first.localeCompare(second));

  it('matches PAINTERS file for file', () => {
    // a mismatch names the file: walk its ancestors, then update both sides
    expect(discovered).toEqual(
      [...PAINTERS].sort(([first], [second]) => first.localeCompare(second)),
    );
  });
});

describe('every chain layer is a bundle background token', () => {
  const chains = BUNDLES.flatMap((bundle) => [
    ...BUNDLE_BACKDROPS[bundle],
    ...HIGHLIGHT_BACKDROPS[bundle],
  ]);
  const backgroundTokens = new Set(BUNDLES.map((bundle) => `--${bundle}-bg`));

  it('names nothing a backdrop that is not a surface', () => {
    const foreign = chains.flatMap((chain) =>
      chain.filter((token) => !backgroundTokens.has(token)),
    );
    expect(foreign).toEqual([]);
  });

  it('bottoms out at the page background', () => {
    for (const chain of chains) {
      if (chain.length === 0) continue;
      expect(chain[chain.length - 1]).toBe('--base-bg');
    }
  });
});
