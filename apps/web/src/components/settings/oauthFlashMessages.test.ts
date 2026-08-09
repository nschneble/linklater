/**
 * Tests for the OAuth-link copy catalog.
 *
 * The copy rules are the point of these tests, not the strings themselves:
 * a declined consent screen is not a fault, and the recovery has to name a
 * control the settings page actually shows.
 */

import { describe, expect, it } from 'vitest';
import {
  LINK_ERROR_CODES,
  linkedMessage,
  linkErrorMessage,
} from './oauthFlashMessages';

// every one of these resolves on a plain object literal without ?? firing
const INHERITED_KEYS = Object.getOwnPropertyNames(Object.prototype);

describe('linkErrorMessage', () => {
  it('answers for a code this build does not know', () => {
    // the value rides in on a URL, so anything at all can arrive here
    expect(linkErrorMessage('something_new')).toBe(
      'Failed to connect account.',
    );
  });

  it('answers with the unknown copy for an Object.prototype member', () => {
    const unknown = linkErrorMessage('something_new');

    for (const inherited of INHERITED_KEYS) {
      const message = linkErrorMessage(inherited);
      expect(typeof message).toBe('string');
      expect(message).toBe(unknown);
    }
  });

  it('covers every code the API can send', () => {
    const unknown = linkErrorMessage('something_new');
    for (const code of LINK_ERROR_CODES) {
      expect(linkErrorMessage(code)).not.toBe(unknown);
    }
  });

  it('offers the recovery by the name the control carries', () => {
    for (const code of ['cancelled', 'provider_error', 'state_invalid']) {
      expect(linkErrorMessage(code)).toContain('Connect Google');
    }
  });

  it('speaks of logging in the way the section heading does', () => {
    for (const code of LINK_ERROR_CODES) {
      expect(linkErrorMessage(code).toLowerCase()).not.toContain('sign in');
      expect(linkErrorMessage(code).toLowerCase()).not.toContain('sign-in');
    }
  });

  it('reports a declined consent screen without blaming anyone for it', () => {
    const cancelled = linkErrorMessage('cancelled').toLowerCase();

    for (const blame of ['error', 'fail', "couldn't", 'went wrong', 'sorry']) {
      expect(cancelled).not.toContain(blame);
    }
  });
});

describe('linkedMessage', () => {
  it('names the provider it knows', () => {
    expect(linkedMessage('google')).toBe('Google account connected.');
  });

  it('answers with provider-agnostic copy for anything else', () => {
    expect(linkedMessage('plurkmail')).toBe('Account connected.');
  });

  it('answers with the fallback for an Object.prototype member', () => {
    for (const inherited of INHERITED_KEYS) {
      expect(linkedMessage(inherited)).toBe('Account connected.');
    }
  });
});
