// unit tests for the pure sync logic; disk-behavior coverage lives in
// font-awesome-manifest.test.ts

import {
  computeNextManifest,
  serializeManifest,
  SyncError,
} from './sync-fa-manifest.mjs';
import { describe, expect, it } from 'vitest';
import type { Catalogs, Manifest, ScanHit } from './fa-scan';

function hitsFrom(tokens: string[]): Map<string, ScanHit> {
  const map = new Map<string, ScanHit>();
  for (const token of tokens) {
    map.set(token, { token, files: new Set(['fake.tsx']) });
  }
  return map;
}

function catalogsFrom({
  solid = [],
  brands = [],
}: {
  solid?: string[];
  brands?: string[];
}): Catalogs {
  return { solid: new Set(solid), brands: new Set(brands) };
}

const emptyManifest: Manifest = { brands: [], regular: [], solid: [] };

describe('computeNextManifest', () => {
  it('adds new icons routed by single-catalog membership', () => {
    const { manifest } = computeNextManifest({
      hits: hitsFrom(['fa-check', 'fa-google']),
      catalogs: catalogsFrom({ solid: ['check'], brands: ['google'] }),
      currentManifest: emptyManifest,
    });

    expect(manifest).toEqual({
      brands: ['google'],
      regular: [],
      solid: ['check'],
    });
  });

  it('preserves family for icons already present in the manifest', () => {
    const { manifest } = computeNextManifest({
      hits: hitsFrom(['fa-apple']),
      catalogs: catalogsFrom({ solid: ['apple'], brands: ['apple'] }),
      currentManifest: { brands: ['apple'], regular: [], solid: [] },
    });

    expect(manifest).toEqual({ brands: ['apple'], regular: [], solid: [] });
  });

  it('routes icons used with a fa-regular sibling class into regular', () => {
    const { manifest } = computeNextManifest({
      hits: hitsFrom(['fa-keyboard']),
      catalogs: catalogsFrom({ solid: ['keyboard'] }),
      currentManifest: emptyManifest,
      regularNames: new Set(['keyboard']),
    });

    expect(manifest).toEqual({
      brands: [],
      regular: ['keyboard'],
      solid: ['keyboard'],
    });
  });

  it('drops manifest entries no longer referenced in source', () => {
    const { manifest, summary } = computeNextManifest({
      hits: hitsFrom(['fa-check']),
      catalogs: catalogsFrom({ solid: ['check', 'gear'] }),
      currentManifest: { brands: [], regular: [], solid: ['check', 'gear'] },
    });

    expect(manifest).toEqual({ brands: [], regular: [], solid: ['check'] });
    expect(summary.removed.solid).toEqual(['gear']);
  });

  it('ignores fa-* utility class tokens', () => {
    const { manifest } = computeNextManifest({
      hits: hitsFrom(['fa-solid', 'fa-fw', 'fa-spin', 'fa-check']),
      catalogs: catalogsFrom({ solid: ['check'] }),
      currentManifest: emptyManifest,
    });

    expect(manifest).toEqual({ brands: [], regular: [], solid: ['check'] });
  });

  it('sorts each family alphabetically', () => {
    const { manifest } = computeNextManifest({
      hits: hitsFrom(['fa-zoom', 'fa-arrow', 'fa-check']),
      catalogs: catalogsFrom({ solid: ['zoom', 'arrow', 'check'] }),
      currentManifest: emptyManifest,
    });

    expect(manifest.solid).toEqual(['arrow', 'check', 'zoom']);
  });

  it('throws SyncError(kind: "unknown") for fa-* tokens with no catalog match', () => {
    expect(() =>
      computeNextManifest({
        hits: hitsFrom(['fa-triangle-excl', 'fa-check']),
        catalogs: catalogsFrom({ solid: ['check'] }),
        currentManifest: emptyManifest,
      }),
    ).toThrow(SyncError);
  });

  it('throws SyncError(kind: "ambiguous") for new icons in both catalogs', () => {
    let caught: unknown;
    try {
      computeNextManifest({
        hits: hitsFrom(['fa-apple']),
        catalogs: catalogsFrom({ solid: ['apple'], brands: ['apple'] }),
        currentManifest: emptyManifest,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(SyncError);
    expect((caught as SyncError).kind).toBe('ambiguous');
  });

  it('reports added and removed icons in the summary', () => {
    const { summary } = computeNextManifest({
      hits: hitsFrom(['fa-check', 'fa-gear']),
      catalogs: catalogsFrom({ solid: ['check', 'gear', 'ban'] }),
      currentManifest: { brands: [], regular: [], solid: ['ban', 'check'] },
    });

    expect(summary.added.solid).toEqual(['gear']);
    expect(summary.removed.solid).toEqual(['ban']);
  });
});

describe('serializeManifest', () => {
  it('produces stable two-space JSON with trailing newline', () => {
    const output = serializeManifest({
      brands: ['google'],
      solid: ['check', 'gear'],
    });

    expect(output).toBe(
      '{\n  "brands": [\n    "google"\n  ],\n  "solid": [\n    "check",\n    "gear"\n  ]\n}\n',
    );
  });
});
