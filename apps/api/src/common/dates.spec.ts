import { expiresInMs } from './dates.js';
import { jest } from '@jest/globals';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('expiresInMs', () => {
  it('returns a Date roughly ms milliseconds from now', () => {
    const before = Date.now();
    const result = expiresInMs(5000);
    const after = Date.now();

    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThanOrEqual(before + 5000);
    expect(result.getTime()).toBeLessThanOrEqual(after + 5000);
  });

  it('returns a date in the past when ms is negative', () => {
    const result = expiresInMs(-1000);

    expect(result.getTime()).toBeLessThan(Date.now());
  });

  it('returns approximately now when ms is zero', () => {
    const before = Date.now();
    const result = expiresInMs(0);
    const after = Date.now();

    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });
});
