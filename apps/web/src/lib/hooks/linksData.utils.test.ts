import { describe, expect, it } from 'vitest';
import {
  findNewLinks,
  formatNewLinksAnnouncement,
  isMetadataPending,
  isMetadataSettled,
  mergeSettledMetadata,
} from './linksData.utils';
import type { Link, LinkMeta } from '../api';

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    id: 'link-1',
    url: 'https://example.com',
    meta: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    readAt: null,
    ...overrides,
  };
}

function settledMeta(overrides: Partial<LinkMeta> = {}): LinkMeta {
  return {
    title: 'Ready',
    fetchedAt: '2026-07-29T00:00:00.000Z',
    ...overrides,
  };
}

describe('isMetadataSettled / isMetadataPending', () => {
  it('treats a link with a fetchedAt stamp as settled', () => {
    const link = makeLink({ meta: settledMeta() });
    expect(isMetadataSettled(link)).toBe(true);
    expect(isMetadataPending(link)).toBe(false);
  });

  it('treats null metadata as pending', () => {
    const link = makeLink({ meta: null });
    expect(isMetadataSettled(link)).toBe(false);
    expect(isMetadataPending(link)).toBe(true);
  });

  it('treats a meta object without fetchedAt as pending', () => {
    const link = makeLink({ meta: { title: 'Loading', fetchedAt: null } });
    expect(isMetadataSettled(link)).toBe(false);
    expect(isMetadataPending(link)).toBe(true);
  });
});

describe('findNewLinks', () => {
  it('returns only links not present in existing', () => {
    const existing = [makeLink({ id: 'a' }), makeLink({ id: 'b' })];
    const incoming = [
      makeLink({ id: 'a' }),
      makeLink({ id: 'c' }),
      makeLink({ id: 'd' }),
    ];
    expect(findNewLinks(incoming, existing).map((link) => link.id)).toEqual([
      'c',
      'd',
    ]);
  });

  it('returns empty array when all incoming links already exist', () => {
    const existing = [makeLink({ id: 'a' }), makeLink({ id: 'b' })];
    const incoming = [makeLink({ id: 'a' }), makeLink({ id: 'b' })];
    expect(findNewLinks(incoming, existing)).toEqual([]);
  });

  it('returns all incoming links when existing is empty', () => {
    const incoming = [makeLink({ id: 'a' }), makeLink({ id: 'b' })];
    expect(findNewLinks(incoming, []).map((link) => link.id)).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('formatNewLinksAnnouncement', () => {
  it('returns singular form for count of 1', () => {
    expect(formatNewLinksAnnouncement(1)).toBe('1 new link added');
  });

  it('returns plural form for counts greater than 1', () => {
    expect(formatNewLinksAnnouncement(2)).toBe('2 new links added');
    expect(formatNewLinksAnnouncement(10)).toBe('10 new links added');
  });

  it('returns plural form for count of 0', () => {
    expect(formatNewLinksAnnouncement(0)).toBe('0 new links added');
  });
});

describe('mergeSettledMetadata', () => {
  it('keeps the existing settled meta when the incoming copy has null metadata', () => {
    // guards: a stale page-1 meta:null must not un-settle a card to skeleton
    const settled = makeLink({ id: 'x', meta: settledMeta() });
    const stale = makeLink({ id: 'x', meta: null });

    const [merged] = mergeSettledMetadata([stale], [settled]);

    expect(merged.meta?.fetchedAt).toBe('2026-07-29T00:00:00.000Z');
    expect(merged.meta?.title).toBe('Ready');
  });

  it('keeps existing meta when the incoming copy has meta present but no fetchedAt', () => {
    // a partial response (fetchedAt nullish) must not regress a settled card
    const settled = makeLink({ id: 'x', meta: settledMeta() });
    const stale = makeLink({
      id: 'x',
      meta: { title: 'Loading', fetchedAt: null },
    });

    const [merged] = mergeSettledMetadata([stale], [settled]);

    expect(merged.meta?.fetchedAt).toBe('2026-07-29T00:00:00.000Z');
  });

  it('adopts incoming settled meta over a pending existing copy', () => {
    // reverse: don't freeze pending state when the fresh response is settled
    const pending = makeLink({ id: 'x', meta: null });
    const fresh = makeLink({ id: 'x', meta: settledMeta({ title: 'Fresh' }) });

    const [merged] = mergeSettledMetadata([fresh], [pending]);

    expect(merged.meta?.title).toBe('Fresh');
    expect(merged.meta?.fetchedAt).toBe('2026-07-29T00:00:00.000Z');
  });

  it('lets a settled incoming copy win over a settled existing copy', () => {
    // when both are settled, incoming wins as fresh server truth
    const older = makeLink({
      id: 'x',
      meta: settledMeta({
        title: 'Old',
        fetchedAt: '2026-07-01T00:00:00.000Z',
      }),
    });
    const newer = makeLink({
      id: 'x',
      meta: settledMeta({
        title: 'New',
        fetchedAt: '2026-07-29T00:00:00.000Z',
      }),
    });

    const [merged] = mergeSettledMetadata([newer], [older]);

    expect(merged.meta?.title).toBe('New');
    expect(merged.meta?.fetchedAt).toBe('2026-07-29T00:00:00.000Z');
  });

  it('leaves a pending link pending when neither copy is settled', () => {
    const existingPending = makeLink({ id: 'x', meta: null });
    const incomingPending = makeLink({ id: 'x', meta: null });

    const [merged] = mergeSettledMetadata([incomingPending], [existingPending]);

    expect(merged.meta).toBeNull();
  });

  it('passes a brand-new link through untouched when it has no prior copy', () => {
    const existing = [makeLink({ id: 'a', meta: settledMeta() })];
    const brandNew = makeLink({ id: 'b', meta: null });

    const merged = mergeSettledMetadata([brandNew], existing);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe('b');
    expect(merged[0].meta).toBeNull();
  });

  it('adopts every non-meta field from the incoming copy while preserving settled meta', () => {
    // only meta is guarded; url, read state, timestamps come from incoming
    const existing = makeLink({
      id: 'x',
      url: 'https://old.example',
      readAt: null,
      updatedAt: '2026-07-01T00:00:00.000Z',
      meta: settledMeta(),
    });
    const incoming = makeLink({
      id: 'x',
      url: 'https://new.example',
      readAt: '2026-07-29T12:00:00.000Z',
      updatedAt: '2026-07-29T12:00:00.000Z',
      meta: null,
    });

    const [merged] = mergeSettledMetadata([incoming], [existing]);

    expect(merged.url).toBe('https://new.example');
    expect(merged.readAt).toBe('2026-07-29T12:00:00.000Z');
    expect(merged.updatedAt).toBe('2026-07-29T12:00:00.000Z');
    expect(merged.meta?.fetchedAt).toBe('2026-07-29T00:00:00.000Z');
  });

  it('takes ordering and membership from the incoming list', () => {
    // incoming wins order + membership; a link absent from incoming is dropped
    const existing = [
      makeLink({ id: 'a', meta: settledMeta() }),
      makeLink({ id: 'b', meta: settledMeta() }),
      makeLink({ id: 'gone', meta: settledMeta() }),
    ];
    const incoming = [
      makeLink({ id: 'b', meta: null }),
      makeLink({ id: 'a', meta: null }),
    ];

    const merged = mergeSettledMetadata(incoming, existing);

    expect(merged.map((link) => link.id)).toEqual(['b', 'a']);
    expect(merged.every((link) => Boolean(link.meta?.fetchedAt))).toBe(true);
  });

  it('returns the incoming list as-is when existing is empty', () => {
    const incoming = [
      makeLink({ id: 'a', meta: null }),
      makeLink({ id: 'b', meta: settledMeta() }),
    ];

    const merged = mergeSettledMetadata(incoming, []);

    expect(merged.map((link) => link.id)).toEqual(['a', 'b']);
    expect(merged[0].meta).toBeNull();
  });

  it('does not mutate either input list', () => {
    const existing = [makeLink({ id: 'x', meta: settledMeta() })];
    const incoming = [makeLink({ id: 'x', meta: null })];
    const existingSnapshot = structuredClone(existing);
    const incomingSnapshot = structuredClone(incoming);

    mergeSettledMetadata(incoming, existing);

    expect(existing).toEqual(existingSnapshot);
    expect(incoming).toEqual(incomingSnapshot);
  });

  it('resolves every branch correctly in one mixed list', () => {
    // mixed page-1 settle: preserve, adopt, passthrough, and drop in one list
    const existing = [
      makeLink({ id: 'settled', meta: settledMeta({ title: 'Kept' }) }),
      makeLink({ id: 'pending', meta: null }),
      makeLink({ id: 'gone', meta: settledMeta() }),
    ];
    const incoming = [
      makeLink({ id: 'pending', meta: settledMeta({ title: 'NowReady' }) }),
      makeLink({ id: 'settled', meta: null }),
      makeLink({ id: 'brand-new', meta: null }),
    ];

    const merged = mergeSettledMetadata(incoming, existing);

    expect(merged.map((link) => link.id)).toEqual([
      'pending',
      'settled',
      'brand-new',
    ]);
    expect(merged[0].meta?.title).toBe('NowReady');
    expect(merged[1].meta?.title).toBe('Kept');
    expect(merged[2].meta).toBeNull();
  });
});
