/**
 * Which bodies the extension authorize route refuses once a caller is
 * past the guard.
 *
 * These live over HTTP rather than at the handler for the same reason the
 * guard's do. A handler called directly is handed whatever the test
 * writes, so the DTO's rules only bind a request that went through the
 * pipe. Every case here carries a bearer the strategy accepts, because a
 * guard runs ahead of a pipe and a 401 would settle nothing about the
 * body.
 *
 * The empty-string cases are the ones a required-field check alone lets
 * past: the field is present, so a presence rule is satisfied, and the
 * service would receive a value it has to reject itself.
 */

import request from 'supertest';

import {
  acceptedToken,
  bootExtensionAuthorizeApp,
  CODE_CHALLENGE,
  REDIRECT_URI,
  resetHarnessMocks,
} from './extension-authorize.harness';
import type { ExtensionAuthorizeHarness } from './extension-authorize.harness';

describe('POST /auth/extension/authorize (body)', () => {
  let harness: ExtensionAuthorizeHarness;

  beforeAll(async () => {
    harness = await bootExtensionAuthorizeApp();
  });

  afterAll(async () => {
    await harness.app.close();
  });

  beforeEach(() => {
    resetHarnessMocks(harness);
  });

  it('refuses a body carrying neither field', async () => {
    const response = await request(harness.app.getHttpServer())
      .post('/auth/extension/authorize')
      .set('Authorization', `Bearer ${acceptedToken()}`)
      .send({});

    expect(response.status).toBe(400);
    expect(
      harness.extensionAuthServiceMock.authorizeExtension,
    ).not.toHaveBeenCalled();
  });

  it.each([
    ['codeChallenge', { codeChallenge: '', redirectUri: REDIRECT_URI }],
    ['redirectUri', { codeChallenge: CODE_CHALLENGE, redirectUri: '' }],
  ])(
    'refuses an empty %s rather than handing it to the service',
    async (_field, body) => {
      const response = await request(harness.app.getHttpServer())
        .post('/auth/extension/authorize')
        .set('Authorization', `Bearer ${acceptedToken()}`)
        .send(body);

      expect(response.status).toBe(400);
      expect(
        harness.extensionAuthServiceMock.authorizeExtension,
      ).not.toHaveBeenCalled();
    },
  );
});
