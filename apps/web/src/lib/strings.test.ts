import { describe, expect, it } from 'vitest';
import { capitalizeFirst, stripHtml } from './strings';

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

describe('stripHtml', () => {
  it('removes html tags', () => {
    expect(stripHtml('<p>Hello <b>world</b></p>')).toBe('Hello world');
  });

  it('decodes html entities', () => {
    expect(stripHtml('AT&amp;T &mdash; &lt;great&gt;')).toBe('AT&T — <great>');
  });

  it('returns plain text unchanged', () => {
    expect(stripHtml('No tags here')).toBe('No tags here');
  });

  it('returns empty string for empty input', () => {
    expect(stripHtml('')).toBe('');
  });
});
