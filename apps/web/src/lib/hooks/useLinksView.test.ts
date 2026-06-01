import { describe, expect, it } from 'vitest';
import { filterFromPath } from './useLinksView';

describe('filterFromPath', () => {
  it('returns "read" for the /read pathname', () => {
    expect(filterFromPath('/read')).toBe('read');
  });

  it('returns "unread" for the /unread pathname', () => {
    expect(filterFromPath('/unread')).toBe('unread');
  });

  it('returns "unread" for the root pathname', () => {
    expect(filterFromPath('/')).toBe('unread');
  });

  it('returns "unread" for any pathname that is not exactly /read', () => {
    expect(filterFromPath('/settings')).toBe('unread');
    expect(filterFromPath('/read/extra')).toBe('unread');
    expect(filterFromPath('')).toBe('unread');
  });
});
