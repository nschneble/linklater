/*
 * The refusal half of the check matters more than the acceptance half.
 * `redirect_uri` arrives on this page's own URL, so anything that reaches
 * `window.location.href` unchecked is an open redirect a phishing link can
 * aim anywhere it likes.
 */

import { describe, expect, it } from 'vitest';
import { extensionDenialUrl } from './extensionDenialUrl';

describe('extensionDenialUrl', () => {
  it('appends the RFC 6749 denial code to a chrome extension callback', () => {
    expect(extensionDenialUrl('chrome-extension://abc/callback')).toBe(
      'chrome-extension://abc/callback?error=access_denied',
    );
  });

  it('accepts a Firefox extension callback', () => {
    expect(extensionDenialUrl('moz-extension://a-b-c/callback')).toBe(
      'moz-extension://a-b-c/callback?error=access_denied',
    );
  });

  it('accepts the host chrome.identity mints for a web auth flow', () => {
    expect(extensionDenialUrl('https://abcdef.chromiumapp.org/')).toBe(
      'https://abcdef.chromiumapp.org/?error=access_denied',
    );
  });

  it('keeps query parameters the extension already put there', () => {
    expect(extensionDenialUrl('chrome-extension://abc/cb?flow=7')).toBe(
      'chrome-extension://abc/cb?flow=7&error=access_denied',
    );
  });

  it('refuses an arbitrary https destination', () => {
    expect(extensionDenialUrl('https://evil.example.com/steal')).toBeNull();
  });

  it('refuses a host merely containing the web auth suffix', () => {
    expect(
      extensionDenialUrl('https://abcdef.chromiumapp.org.evil.example.com/'),
    ).toBeNull();
  });

  it('refuses the web auth host over plain http, which any hop can forge', () => {
    expect(extensionDenialUrl('http://abcdef.chromiumapp.org/')).toBeNull();
  });

  it('refuses a host ending in the suffix without the label boundary', () => {
    expect(extensionDenialUrl('https://evilchromiumapp.org/')).toBeNull();
  });

  it('refuses a javascript URL, which parses but has no host', () => {
    expect(extensionDenialUrl('javascript:alert(1)')).toBeNull();
  });

  it('refuses a value that is not a URL at all', () => {
    expect(extensionDenialUrl('not-a-url')).toBeNull();
  });

  it('refuses an empty value, which is what a missing parameter reads as', () => {
    expect(extensionDenialUrl('')).toBeNull();
  });
});
