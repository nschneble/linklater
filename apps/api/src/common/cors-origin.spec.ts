import { parseCorsOrigin } from './cors-origin.js';

describe('parseCorsOrigin', () => {
  it('returns "*" when the value is undefined', () => {
    expect(parseCorsOrigin(undefined)).toBe('*');
  });

  it('returns "*" when the value is an empty string', () => {
    expect(parseCorsOrigin('')).toBe('*');
  });

  it('returns "*" when the value is only whitespace or commas', () => {
    expect(parseCorsOrigin('  ')).toBe('*');
    expect(parseCorsOrigin(', ,')).toBe('*');
  });

  it('returns the single origin as a string for exact matching', () => {
    expect(parseCorsOrigin('https://app.linklater.dev')).toBe(
      'https://app.linklater.dev',
    );
  });

  it('trims surrounding whitespace on a single origin', () => {
    expect(parseCorsOrigin('  https://app.linklater.dev  ')).toBe(
      'https://app.linklater.dev',
    );
  });

  it('returns an array when given a comma-separated list of origins', () => {
    expect(
      parseCorsOrigin(
        'https://app.linklater.dev,chrome-extension://abcdef,moz-extension://123456',
      ),
    ).toEqual([
      'https://app.linklater.dev',
      'chrome-extension://abcdef',
      'moz-extension://123456',
    ]);
  });

  it('trims each entry and drops empty entries in a list', () => {
    expect(
      parseCorsOrigin(
        ' https://app.linklater.dev , chrome-extension://abcdef ,',
      ),
    ).toEqual(['https://app.linklater.dev', 'chrome-extension://abcdef']);
  });
});
