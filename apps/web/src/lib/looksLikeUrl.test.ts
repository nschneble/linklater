import { describe, expect, it } from 'vitest';
import { looksLikeUrl } from './looksLikeUrl';

describe('looksLikeUrl', () => {
  it('accepts http URLs', () => {
    expect(looksLikeUrl('http://example.com')).toBe(true);
  });

  it('accepts https URLs', () => {
    expect(looksLikeUrl('https://example.com/article')).toBe(true);
  });

  it('rejects plain text', () => {
    expect(looksLikeUrl('just some words')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(looksLikeUrl('')).toBe(false);
  });

  it('rejects a URL with leading whitespace (caller trims first)', () => {
    expect(looksLikeUrl('  https://example.com')).toBe(false);
  });
});
