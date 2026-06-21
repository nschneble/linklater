import { describe, expect, it } from 'vitest';
import { endpointHeadingId, endpointSlug } from './endpointId';

describe('endpointSlug', () => {
  it('slugs method + path into a lowercase hyphenated token', () => {
    expect(endpointSlug('GET', '/links')).toBe('get-links');
  });

  it('collapses path parameters and punctuation into single hyphens', () => {
    expect(endpointSlug('delete', '/links/{id}')).toBe('delete-links-id');
  });

  it('trims leading and trailing hyphens', () => {
    expect(endpointSlug('get', '/')).toBe('get');
  });

  it('is stable across method casing', () => {
    expect(endpointSlug('PoSt', '/links')).toBe(endpointSlug('post', '/links'));
  });
});

describe('endpointHeadingId', () => {
  it('prefixes the slug with "endpoint-"', () => {
    expect(endpointHeadingId('get', '/links')).toBe('endpoint-get-links');
  });
});
