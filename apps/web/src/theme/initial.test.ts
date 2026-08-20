import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getInitialBaseTheme, getInitialMode } from './initial';

function stubMatchMedia(matches: boolean): void {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: '(prefers-color-scheme: light)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      onchange: null,
    }),
  });
}

describe('getInitialBaseTheme', () => {
  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns scanner-darkly when no theme is stored', () => {
    expect(getInitialBaseTheme()).toBe('scanner-darkly');
  });

  it('returns the stored theme when it is a valid base theme id', () => {
    window.localStorage.setItem('linklater_theme', 'boyhood');
    expect(getInitialBaseTheme()).toBe('boyhood');
  });

  it('falls back to scanner-darkly when the stored value is not a valid theme id', () => {
    window.localStorage.setItem('linklater_theme', 'not-a-real-theme');
    expect(getInitialBaseTheme()).toBe('scanner-darkly');
  });

  it('falls back to scanner-darkly when the stored value is an empty string', () => {
    window.localStorage.setItem('linklater_theme', '');
    expect(getInitialBaseTheme()).toBe('scanner-darkly');
  });

  it('accepts all valid base theme ids', () => {
    const validThemes = [
      'apollo-10-1-2',
      'before-midnight',
      'before-sunrise',
      'before-sunset',
      'boyhood',
      'dazed-and-confused',
      'hit-man',
      'nouvelle-vague',
      'scanner-darkly',
      'school-of-rock',
    ];
    for (const themeId of validThemes) {
      window.localStorage.setItem('linklater_theme', themeId);
      expect(getInitialBaseTheme()).toBe(themeId);
    }
  });
});

describe('getInitialMode', () => {
  beforeEach(() => {
    // jsdom lacks matchMedia; stub it so tests that ignore it still pass
    stubMatchMedia(false);
  });

  afterEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns "light" when "light" is stored', () => {
    window.localStorage.setItem('linklater_mode', 'light');
    expect(getInitialMode()).toBe('light');
  });

  it('returns "dark" when "dark" is stored', () => {
    window.localStorage.setItem('linklater_mode', 'dark');
    expect(getInitialMode()).toBe('dark');
  });

  it('falls back to "light" from OS preference when nothing is stored and prefers-color-scheme is light', () => {
    stubMatchMedia(true);
    expect(getInitialMode()).toBe('light');
  });

  it('falls back to "dark" when nothing is stored and prefers-color-scheme is not light', () => {
    stubMatchMedia(false);
    expect(getInitialMode()).toBe('dark');
  });

  it('falls back to OS preference when the stored mode is an unrecognized value', () => {
    window.localStorage.setItem('linklater_mode', 'system');
    stubMatchMedia(true);
    expect(getInitialMode()).toBe('light');
  });

  it('adopts the OS value when the stored mode is the one the OS moved off', () => {
    window.localStorage.setItem('linklater_mode', 'dark');
    window.localStorage.setItem('linklater_last_seen_system_mode', 'dark');
    stubMatchMedia(true);
    expect(getInitialMode()).toBe('light');
  });

  it('keeps a stored mode the OS was already disagreeing with', () => {
    window.localStorage.setItem('linklater_mode', 'dark');
    window.localStorage.setItem('linklater_last_seen_system_mode', 'light');
    stubMatchMedia(true);
    expect(getInitialMode()).toBe('dark');
  });

  it('keeps the stored mode when no OS value has been seen yet', () => {
    window.localStorage.setItem('linklater_mode', 'dark');
    stubMatchMedia(true);
    expect(getInitialMode()).toBe('dark');
  });

  it('takes the OS value when nothing is stored, whatever it last saw', () => {
    window.localStorage.setItem('linklater_last_seen_system_mode', 'dark');
    stubMatchMedia(true);
    expect(getInitialMode()).toBe('light');
  });
});
