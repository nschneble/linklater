/**
 * Tests for the OAuth failure copy catalog.
 *
 * The copy rules are the point of these tests, not the strings themselves:
 * a refused account may have no password at all, and the recovery verb has
 * to match the controls on the page.
 */

import { authErrorMessage } from './authFlashMessages';
import { describe, expect, it } from 'vitest';

const CODES = [
  'mfa_required',
  'oauth_failed',
  'oauth_state_invalid',
  'provider_email_unverified',
];

describe('authErrorMessage', () => {
  it('names the provider when the redirect carries one', () => {
    expect(authErrorMessage('provider_email_unverified', 'google')).toBe(
      "Google hasn't confirmed this email address. Log in with your email instead.",
    );
    expect(authErrorMessage('provider_email_unverified', 'apple')).toBe(
      "Apple hasn't confirmed this email address. Log in with your email instead.",
    );
  });

  it('falls back to provider-agnostic copy when the redirect carries none', () => {
    expect(authErrorMessage('provider_email_unverified', null)).toBe(
      "That sign-in didn't confirm this email address. Log in with your email instead.",
    );
  });

  it('falls back to the code alone when the provider is unknown', () => {
    expect(authErrorMessage('mfa_required', 'myspace')).toBe(
      "That sign-in can't ask for your authenticator code. Log in with your email instead.",
    );
  });

  it('answers for a code this build does not know', () => {
    // the value rides in on a URL, so anything at all can arrive here
    expect(authErrorMessage('something_new', 'google')).toBe(
      "That sign-in didn't finish. Log in with your email instead.",
    );
  });

  it('covers every code the API can send', () => {
    const unknown = authErrorMessage('something_new', null);
    for (const code of CODES) {
      expect(authErrorMessage(code, null)).not.toBe(unknown);
      expect(authErrorMessage(code, 'google')).not.toBe(unknown);
      expect(authErrorMessage(code, 'apple')).not.toBe(unknown);
    }
  });

  it('never points a refused account at a password it may not have', () => {
    for (const code of CODES) {
      for (const provider of [null, 'google', 'apple']) {
        expect(authErrorMessage(code, provider).toLowerCase()).not.toContain(
          'password',
        );
      }
    }
  });

  it('offers the same recovery verb the form controls use', () => {
    for (const code of CODES) {
      for (const provider of [null, 'google', 'apple']) {
        expect(authErrorMessage(code, provider).toLowerCase()).toContain(
          'log in with your email',
        );
      }
    }
  });
});
