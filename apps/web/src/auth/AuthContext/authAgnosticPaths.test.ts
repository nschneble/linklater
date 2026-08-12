/**
 * Pins the guard's list of paths that render without consulting auth
 * state against the route table those paths come from.
 *
 * The guard cannot import `routes/Common.tsx` without dragging every page
 * component into an auth hook, so it restates the paths. A restatement
 * that nothing checks goes stale the first time a route is added, and it
 * goes stale silently in the direction that hurts: a new form route
 * missing from the list is one the guard will replace mid-entry.
 */

import { AUTH_AGNOSTIC_PATHS } from './useIdentityGuard';
import { commonRoutes } from '../../routes/Common';
import { describe, expect, it } from 'vitest';

function declaredCommonPaths(): string[] {
  return commonRoutes().map((route) => (route.props as { path: string }).path);
}

describe('the paths the guard treats as auth-agnostic', () => {
  it('covers every path the common route table declares', () => {
    const uncovered = declaredCommonPaths().filter(
      (path) => !AUTH_AGNOSTIC_PATHS.has(path),
    );
    expect(uncovered).toEqual([]);
  });

  it('claims no path that table does not declare', () => {
    const declared = new Set(declaredCommonPaths());
    const stale = [...AUTH_AGNOSTIC_PATHS].filter(
      (path) => !declared.has(path),
    );
    expect(stale).toEqual([]);
  });

  it('reads a real table rather than an empty one, which would pass both', () => {
    expect(declaredCommonPaths().length).toBeGreaterThan(0);
  });

  it('declares no parameterized route, which no lookup here could match', () => {
    // both filters above pass `/docs/:section`; no lookup ever matches it
    const parameterized = declaredCommonPaths().filter(
      (path) => path.includes(':') || path.includes('*'),
    );
    expect(parameterized).toEqual([]);
  });

  it('spells each path the way the guard normalizes an address bar', () => {
    // an entry the normalizer cannot produce is an entry it cannot find
    const unnormalized = [...AUTH_AGNOSTIC_PATHS].filter(
      (path) => path !== path.toLowerCase() || path.endsWith('/'),
    );
    expect(unnormalized).toEqual([]);
  });
});
