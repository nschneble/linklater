import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatRelativeTimeFuzzy } from './dates';

const NOW = new Date('2026-05-26T12:00:00.000Z');

function ago(milliseconds: number): Date {
  return new Date(NOW.getTime() - milliseconds);
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('formatRelativeTimeFuzzy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "a few seconds ago" for sub-minute deltas', () => {
    expect(formatRelativeTimeFuzzy(ago(0))).toBe('a few seconds ago');
    expect(formatRelativeTimeFuzzy(ago(30 * SECOND))).toBe('a few seconds ago');
    expect(formatRelativeTimeFuzzy(ago(59 * SECOND))).toBe('a few seconds ago');
  });

  it('returns "a minute ago" between 1 and 2 minutes', () => {
    expect(formatRelativeTimeFuzzy(ago(MINUTE))).toBe('a minute ago');
    expect(formatRelativeTimeFuzzy(ago(MINUTE + 30 * SECOND))).toBe(
      'a minute ago',
    );
  });

  it('returns "a few minutes ago" between 2 and 60 minutes', () => {
    expect(formatRelativeTimeFuzzy(ago(2 * MINUTE))).toBe('a few minutes ago');
    expect(formatRelativeTimeFuzzy(ago(20 * MINUTE))).toBe('a few minutes ago');
    expect(formatRelativeTimeFuzzy(ago(59 * MINUTE))).toBe('a few minutes ago');
  });

  it('returns "an hour ago" between 1 and 2 hours', () => {
    expect(formatRelativeTimeFuzzy(ago(HOUR))).toBe('an hour ago');
    expect(formatRelativeTimeFuzzy(ago(HOUR + 30 * MINUTE))).toBe(
      'an hour ago',
    );
  });

  it('returns "a few hours ago" between 2 and 24 hours', () => {
    expect(formatRelativeTimeFuzzy(ago(2 * HOUR))).toBe('a few hours ago');
    expect(formatRelativeTimeFuzzy(ago(23 * HOUR))).toBe('a few hours ago');
  });

  it('returns "a day ago" between 1 and 2 days', () => {
    expect(formatRelativeTimeFuzzy(ago(DAY))).toBe('a day ago');
    expect(formatRelativeTimeFuzzy(ago(DAY + 12 * HOUR))).toBe('a day ago');
  });

  it('returns "a few days ago" between 2 and 7 days', () => {
    expect(formatRelativeTimeFuzzy(ago(2 * DAY))).toBe('a few days ago');
    expect(formatRelativeTimeFuzzy(ago(6 * DAY))).toBe('a few days ago');
  });

  it('returns "a week ago" between 7 and 14 days', () => {
    expect(formatRelativeTimeFuzzy(ago(7 * DAY))).toBe('a week ago');
    expect(formatRelativeTimeFuzzy(ago(13 * DAY))).toBe('a week ago');
  });

  it('returns "a few weeks ago" between 14 and 28 days', () => {
    expect(formatRelativeTimeFuzzy(ago(14 * DAY))).toBe('a few weeks ago');
    expect(formatRelativeTimeFuzzy(ago(27 * DAY))).toBe('a few weeks ago');
  });

  it('returns "a month ago" between 28 and 60 days', () => {
    expect(formatRelativeTimeFuzzy(ago(28 * DAY))).toBe('a month ago');
    expect(formatRelativeTimeFuzzy(ago(45 * DAY))).toBe('a month ago');
  });

  it('returns "a few months ago" between 60 and 365 days', () => {
    expect(formatRelativeTimeFuzzy(ago(60 * DAY))).toBe('a few months ago');
    expect(formatRelativeTimeFuzzy(ago(364 * DAY))).toBe('a few months ago');
  });

  it('returns "over a year ago" past 365 days', () => {
    expect(formatRelativeTimeFuzzy(ago(365 * DAY))).toBe('over a year ago');
    expect(formatRelativeTimeFuzzy(ago(3 * 365 * DAY))).toBe('over a year ago');
  });

  it('accepts ISO strings', () => {
    expect(formatRelativeTimeFuzzy(ago(5 * MINUTE).toISOString())).toBe(
      'a few minutes ago',
    );
  });

  it('clamps future dates to "a few seconds ago"', () => {
    const future = new Date(NOW.getTime() + 60 * SECOND);
    expect(formatRelativeTimeFuzzy(future)).toBe('a few seconds ago');
  });
});
