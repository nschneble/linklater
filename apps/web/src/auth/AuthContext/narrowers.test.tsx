import { describe, expect, it, vi } from 'vitest';
import { narrowMode, narrowTheme } from './useAuthState';

describe('narrowMode', () => {
  it('passes "light" through unchanged', () => {
    expect(narrowMode('light')).toBe('light');
  });

  it('passes "dark" through unchanged', () => {
    expect(narrowMode('dark')).toBe('dark');
  });

  it('falls back to "dark" for unknown values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(narrowMode('auto')).toBe('dark');
    expect(narrowMode('system')).toBe('dark');
    expect(narrowMode('')).toBe('dark');
    warn.mockRestore();
  });

  it('logs a dev-only warning describing the unknown value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    narrowMode('auto');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown server mode "auto"'),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('falling back to "dark"'),
    );
    warn.mockRestore();
  });

  it('does not warn for known values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    narrowMode('light');
    narrowMode('dark');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('narrowTheme', () => {
  it('passes a known theme id through unchanged', () => {
    expect(narrowTheme('scanner-darkly')).toBe('scanner-darkly');
    expect(narrowTheme('apollo-10-1-2')).toBe('apollo-10-1-2');
    expect(narrowTheme('boyhood')).toBe('boyhood');
  });

  it('falls back to "scanner-darkly" for unknown theme ids', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(narrowTheme('not-a-real-theme')).toBe('scanner-darkly');
    expect(narrowTheme('')).toBe('scanner-darkly');
    warn.mockRestore();
  });

  it('logs a dev-only warning describing the unknown theme id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    narrowTheme('not-a-real-theme');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('Unknown server theme "not-a-real-theme"'),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('falling back to "scanner-darkly"'),
    );
    warn.mockRestore();
  });

  it('does not warn for known theme ids', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    narrowTheme('scanner-darkly');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
