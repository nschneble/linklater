/**
 * Tests for `gravatarUrl`.
 *
 * Gravatar URLs are deterministic: the email is normalized (trim + lowercase)
 * and MD5-hashed before being embedded in the URL. Tests verify correctness
 * of the URL structure and normalization behaviour.
 */

import { describe, expect, it } from 'vitest';
import { gravatarUrl } from './gravatar';

describe('gravatarUrl', () => {
  it('returns a gravatar.com URL', () => {
    const url = gravatarUrl('user@example.com');
    expect(url).toMatch(/^https:\/\/www\.gravatar\.com\/avatar\//);
  });

  it('includes the default identicon fallback', () => {
    const url = gravatarUrl('user@example.com');
    expect(url).toContain('d=identicon');
  });

  it('includes the requested size in the query string', () => {
    const url = gravatarUrl('user@example.com', 64);
    expect(url).toContain('s=64');
  });

  it('defaults to size 80 when no size is provided', () => {
    const url = gravatarUrl('user@example.com');
    expect(url).toContain('s=80');
  });

  it('normalizes the email to lowercase before hashing', () => {
    const lower = gravatarUrl('user@example.com');
    const upper = gravatarUrl('USER@EXAMPLE.COM');
    expect(lower).toBe(upper);
  });

  it('trims whitespace from the email before hashing', () => {
    const trimmed = gravatarUrl('user@example.com');
    const padded = gravatarUrl('  user@example.com  ');
    expect(trimmed).toBe(padded);
  });

  it('produces different hashes for different emails', () => {
    const first = gravatarUrl('alice@example.com');
    const second = gravatarUrl('bob@example.com');
    expect(first).not.toBe(second);
  });

  it('embeds a 32-character MD5 hash in the URL', () => {
    const url = gravatarUrl('user@example.com');
    const match = url.match(/\/avatar\/([a-f0-9]+)\?/);
    expect(match).not.toBeNull();
    expect(match![1]).toHaveLength(32);
  });
});
