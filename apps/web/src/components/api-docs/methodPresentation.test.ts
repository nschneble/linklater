import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ICON,
  DEFAULT_PALETTE,
  resolveMethodIcon,
  resolveMethodPalette,
} from './methodPresentation';

describe('resolveMethodPalette', () => {
  it('returns the brand palette for a known method, any case', () => {
    expect(resolveMethodPalette('get')).toEqual({
      text: '#a7f3d0',
      border: '#34d399',
    });
  });

  it('shares the amber group between PUT and PATCH', () => {
    expect(resolveMethodPalette('PUT')).toEqual(resolveMethodPalette('patch'));
  });

  it('falls back to the neutral palette for an unknown method', () => {
    expect(resolveMethodPalette('trace')).toBe(DEFAULT_PALETTE);
  });
});

describe('resolveMethodIcon', () => {
  it('returns the glyph for a known method, any case', () => {
    expect(resolveMethodIcon('delete')).toBe('fa-trash-can');
  });

  it('shares the pen between PUT and PATCH', () => {
    expect(resolveMethodIcon('put')).toBe(resolveMethodIcon('PATCH'));
  });

  it('falls back to fa-code for an unknown method', () => {
    expect(resolveMethodIcon('trace')).toBe(DEFAULT_ICON);
  });
});
