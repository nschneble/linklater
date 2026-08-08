/**
 * The "less doesn't need more" rule, lifted out of the React effect so it can
 * be reasoned about directly. `useLinksData.test.ts` still owns the end-to-end
 * proof that the auto-load actually fetches; these cases pin the decision
 * itself, including the loop guard that a facade test can only observe
 * indirectly.
 */

import { describe, expect, it } from 'vitest';
import { shouldAutoLoadTrailingItem } from './useLinksFetch.trailingItem';

const settled = {
  loadingLinks: false,
  pagination: { total: 11, limit: 10 },
  linkCount: 10,
  lastFiredKey: null,
};

describe('shouldAutoLoadTrailingItem', () => {
  it('fires when exactly one row is left unfetched', () => {
    expect(shouldAutoLoadTrailingItem(settled)).toBe('10:11');
  });

  it('waits while a fetch is still in flight', () => {
    expect(
      shouldAutoLoadTrailingItem({ ...settled, loadingLinks: true }),
    ).toBeNull();
  });

  it('waits until pagination is known', () => {
    expect(
      shouldAutoLoadTrailingItem({ ...settled, pagination: null }),
    ).toBeNull();
  });

  it('does not fire on an empty list', () => {
    expect(
      shouldAutoLoadTrailingItem({
        ...settled,
        linkCount: 0,
        pagination: { total: 1, limit: 10 },
      }),
    ).toBeNull();
  });

  it.each([
    ['two remaining', 12, 10],
    ['a full page boundary', 20, 10],
    ['nothing remaining', 10, 10],
  ])('does not fire with %s', (_label, total, linkCount) => {
    expect(
      shouldAutoLoadTrailingItem({
        ...settled,
        linkCount,
        pagination: { total, limit: 10 },
      }),
    ).toBeNull();
  });

  it('refuses to re-fire the key it already fired', () => {
    // the follow-up page can come back with no new rows, leaving the counts
    // untouched; without this the effect would re-fire forever
    expect(
      shouldAutoLoadTrailingItem({ ...settled, lastFiredKey: '10:11' }),
    ).toBeNull();
  });

  it('fires again once the counts have actually moved', () => {
    expect(
      shouldAutoLoadTrailingItem({
        loadingLinks: false,
        pagination: { total: 21, limit: 10 },
        linkCount: 20,
        lastFiredKey: '10:11',
      }),
    ).toBe('20:21');
  });
});
