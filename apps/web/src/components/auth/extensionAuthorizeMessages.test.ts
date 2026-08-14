/*
 * The mapping reads `status`, never `message`. `parseError` fills an
 * `ApiError`'s message from the server's own response body, so the house
 * `getErrorMessage` convention would paint raw server text such as
 * "Invalid redirect_uri" into an alert the user is meant to act on.
 */

import { ApiError } from '../../lib/api';
import { authorizeFailureFrom } from './extensionAuthorizeMessages';
import { describe, expect, it } from 'vitest';

describe('authorizeFailureFrom', () => {
  it('reads a refused session off a 401', () => {
    expect(authorizeFailureFrom(new ApiError('Unauthorized', 401))).toBe(
      'session-lost',
    );
  });

  it('reads an unusable request off a 400', () => {
    expect(
      authorizeFailureFrom(new ApiError('Invalid redirect_uri', 400)),
    ).toBe('request-invalid');
  });

  it('treats a server failure as temporary', () => {
    expect(authorizeFailureFrom(new ApiError('Bad gateway', 502))).toBe(
      'unavailable',
    );
  });

  it('treats being rate limited as temporary', () => {
    expect(authorizeFailureFrom(new ApiError('Too many requests', 429))).toBe(
      'unavailable',
    );
  });

  it('treats an unreachable server as temporary', () => {
    expect(
      authorizeFailureFrom(new ApiError('Network request failed', 0)),
    ).toBe('unavailable');
  });

  it('treats a rejection that is not an ApiError as temporary', () => {
    expect(authorizeFailureFrom(new TypeError('Failed to fetch'))).toBe(
      'unavailable',
    );
  });

  it('ignores a message that would otherwise suggest a different kind', () => {
    expect(authorizeFailureFrom(new ApiError('Unauthorized', 500))).toBe(
      'unavailable',
    );
  });
});
