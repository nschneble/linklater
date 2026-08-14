/*
 * What this builds is a link to the decline endpoint, not a decision about
 * where the browser ends up. The decision moved to the server with the
 * allowlist it needs, and the arms that used to live here moved with it:
 * `extension-auth.service.spec.ts` holds the refusals, including the
 * arbitrary https destination, the forged web-auth host, the javascript
 * URL and the empty value, and `extension-deny.http.spec.ts` holds the
 * redirect they produce.
 *
 * What is left is the property the server cannot enforce from where it
 * sits: that this answers with a usable href for every input, including
 * the ones the server is going to turn down. An anchor whose href is
 * missing has no link role, takes no focus and cannot be operated from a
 * keyboard, and it goes on looking exactly like a link that can.
 */

import { API_BASE_URL } from '../../lib/api';
import { describe, expect, it } from 'vitest';
import { extensionDenialUrl } from './extensionDenialUrl';

const DENY_PATH = `${API_BASE_URL}/auth/extension/deny`;

describe('extensionDenialUrl', () => {
  it('points at the decline endpoint, carrying the callback to be judged', () => {
    expect(extensionDenialUrl('chrome-extension://abc/callback')).toBe(
      `${DENY_PATH}?redirect_uri=chrome-extension%3A%2F%2Fabc%2Fcallback`,
    );
  });

  it('encodes a callback that already carries query parameters', () => {
    const built = new URL(
      extensionDenialUrl('https://abc.chromiumapp.org/cb?flow=save&n=1'),
      'https://base.example',
    );

    // the extension's own parameters must not become this URL's parameters
    expect(built.searchParams.get('redirect_uri')).toBe(
      'https://abc.chromiumapp.org/cb?flow=save&n=1',
    );
    expect(built.searchParams.get('flow')).toBeNull();
  });

  it('still answers with a URL for a destination the server will refuse', () => {
    expect(extensionDenialUrl('https://evil.example.com/steal')).toBe(
      `${DENY_PATH}?redirect_uri=https%3A%2F%2Fevil.example.com%2Fsteal`,
    );
  });

  it('still answers with a URL for a value that is not a URL at all', () => {
    expect(extensionDenialUrl('not a url')).toBe(
      `${DENY_PATH}?redirect_uri=not+a+url`,
    );
  });

  it('still answers with a URL for an empty value', () => {
    expect(extensionDenialUrl('')).toBe(`${DENY_PATH}?redirect_uri=`);
  });
});
