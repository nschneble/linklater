/**
 * Tests for the response-to-user mapping.
 *
 * `mapMeToUser` is a pure function, so it is called directly here rather
 * than watched through a hook, a mocked fetch and a `waitFor`, none of
 * which any claim below depends on. That is the same split `jwt.ts` and
 * `jwt.test.ts` use. The two narrowers this module also exports keep
 * their own suite in `narrowers.test.tsx`.
 */

import { describe, expect, it } from 'vitest';
import { mapMeToUser } from './mapMeToUser';
import type { MeResponse } from '../../lib/api';

function makeMeResponse(overrides: Partial<MeResponse> = {}): MeResponse {
  return {
    accountDeletionPending: false,
    connectedProviders: [],
    customTheme: null,
    customThemeEnabled: false,
    cvdMode: false,
    dyslexicFont: false,
    email: 'user@example.com',
    emailVerifiedAt: '2024-01-01T00:00:00Z',
    hasPassword: true,
    mode: 'dark',
    multiFactorMethod: null,
    multiFactorPending: false,
    pendingEmail: null,
    theme: 'scanner-darkly',
    userId: 'user-1',
    welcomedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('dyslexicFont passthrough', () => {
  it('maps a false server dyslexicFont onto the user', () => {
    const user = mapMeToUser(makeMeResponse({ dyslexicFont: false }));
    expect(user.dyslexicFont).toBe(false);
  });

  it('maps a true server dyslexicFont onto the user', () => {
    const user = mapMeToUser(makeMeResponse({ dyslexicFont: true }));
    expect(user.dyslexicFont).toBe(true);
  });
});

describe('customTheme normalization', () => {
  it('normalizes a valid server blob onto user.customTheme', () => {
    const user = mapMeToUser(
      makeMeResponse({
        customTheme: {
          dark: { '--mount-border': '#abcdef', '--bogus-key': '#000000' },
          light: {},
        },
      }),
    );

    // known keys survive; unknown keys are stripped by the trust boundary
    expect(user.customTheme).toEqual({
      dark: { '--mount-border': '#abcdef' },
      light: {},
    });
  });

  it('yields null for a malformed (non-object) customTheme, never raw passthrough', () => {
    const user = mapMeToUser(makeMeResponse({ customTheme: 'not-an-object' }));
    expect(user.customTheme).toBeNull();
  });

  it('coerces an array customTheme to safe empty mode maps', () => {
    const user = mapMeToUser(makeMeResponse({ customTheme: [] }));

    // an array is an object, so normalize yields empty maps, not the array
    expect(user.customTheme).toEqual({ dark: {}, light: {} });
  });
});
