import { describe, expect, it } from 'vitest';
import { capitalizeFirst } from './strings';

describe('capitalizeFirst', () => {
  it('capitalizes the first letter of a lowercase string', () => {
    expect(capitalizeFirst('invalid email')).toBe('Invalid email');
  });

  it('leaves an already-capitalized string unchanged', () => {
    expect(capitalizeFirst('Invalid email')).toBe('Invalid email');
  });

  it('returns an empty string unchanged', () => {
    expect(capitalizeFirst('')).toBe('');
  });

  it('handles a single character', () => {
    expect(capitalizeFirst('x')).toBe('X');
  });
});
