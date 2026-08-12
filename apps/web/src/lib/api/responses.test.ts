import { describe, expect, it } from 'vitest';

import { ApiError, parseError, parseResponse } from './responses';

/**
 * The two readers in isolation. Both take a `Response`, so the fixture is a
 * body and a status rather than a mocked `fetch`; nothing here touches the
 * network or the token store.
 */
describe('responses.ts', () => {
  function respondWith(text: string, status = 200): Response {
    return {
      ok: status >= 200 && status < 300,
      status,
      text: () => Promise.resolve(text),
    } as unknown as Response;
  }

  describe('parseResponse', () => {
    it('returns the parsed body', async () => {
      const result = await parseResponse<{ id: string }>(
        respondWith(JSON.stringify({ id: 'abc' })),
      );

      expect(result).toEqual({ id: 'abc' });
    });

    it('returns undefined for an empty body', async () => {
      const result = await parseResponse(respondWith(''));

      expect(result).toBeUndefined();
    });

    it('throws when a 2xx body is not JSON', async () => {
      // a captive portal or proxy answering 200 with its own login page
      const error = await parseResponse(
        respondWith('<!doctype html><title>Sign in</title>'),
      ).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(0);
      expect((error as ApiError).message).toContain('<!doctype html>');
    });

    it('truncates a long non-JSON body in the thrown message', async () => {
      const error = await parseResponse(respondWith('x'.repeat(500))).catch(
        (caught: unknown) => caught,
      );

      expect((error as ApiError).message).toHaveLength(
        'Server returned non-JSON response: '.length + 100,
      );
    });
  });

  describe('parseError', () => {
    it('prefers the message field of a JSON body', async () => {
      const error = await parseError(
        respondWith(JSON.stringify({ message: 'Invalid input' }), 400),
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error.message).toBe('Invalid input');
      expect(error.status).toBe(400);
    });

    it('falls back to the raw text when the body is not JSON', async () => {
      const error = await parseError(respondWith('Bad gateway', 502));

      expect(error.message).toBe('Bad gateway');
      expect(error.status).toBe(502);
    });

    it('falls back to the raw text when JSON carries no message', async () => {
      const error = await parseError(
        respondWith(JSON.stringify({ code: 'nope' }), 422),
      );

      expect(error.message).toBe(JSON.stringify({ code: 'nope' }));
      expect(error.status).toBe(422);
    });

    it('falls back to the status when the body is empty', async () => {
      const error = await parseError(respondWith('', 503));

      expect(error.message).toBe('Request failed with 503');
      expect(error.status).toBe(503);
    });
  });
});
