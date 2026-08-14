/**
 * Who the extension authorize route turns away, asked over HTTP with the
 * real guard and the real JWT strategy in place.
 *
 * The controller spec cannot see any of this. It overrides `JwtAuthGuard`
 * with a permissive stub, so every refusal is stubbed away before the
 * handler runs, and its guard assertion reads the decorator metadata,
 * which stays true of a route no request can pass. That is the shape that
 * hid a grant endpoint 401ing for every user: the decorator was there, the
 * suite was green, and nothing ever presented a request to it.
 *
 * A bearer header is what the strategy extracts from
 * (`ExtractJwt.fromAuthHeaderAsBearerToken`), so the accepted case here is
 * also the evidence that the caller has to be able to set one.
 *
 * What the pipe refuses once a caller is past the guard is the sibling
 * file's question.
 */

import request from 'supertest';

import {
  acceptedToken,
  bootExtensionAuthorizeApp,
  CODE,
  CODE_CHALLENGE,
  REDIRECT_URI,
  resetHarnessMocks,
  signToken,
  USER_EMAIL,
  USER_ID,
} from './extension-authorize.harness';
import type { ExtensionAuthorizeHarness } from './extension-authorize.harness';

describe('POST /auth/extension/authorize (guard)', () => {
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

  it('refuses a request carrying no Authorization header', async () => {
    const response = await request(harness.app.getHttpServer())
      .post('/auth/extension/authorize')
      .send({ codeChallenge: CODE_CHALLENGE, redirectUri: REDIRECT_URI });

    expect(response.status).toBe(401);
    expect(
      harness.extensionAuthServiceMock.authorizeExtension,
    ).not.toHaveBeenCalled();
  });

  it('refuses a bearer token signed with another secret', async () => {
    const forged = signToken(
      { subject: USER_ID, email: USER_EMAIL },
      'not-the-server-secret',
    );

    const response = await request(harness.app.getHttpServer())
      .post('/auth/extension/authorize')
      .set('Authorization', `Bearer ${forged}`)
      .send({ codeChallenge: CODE_CHALLENGE, redirectUri: REDIRECT_URI });

    expect(response.status).toBe(401);
    expect(
      harness.extensionAuthServiceMock.authorizeExtension,
    ).not.toHaveBeenCalled();
  });

  it('refuses an MFA challenge token, which is not a full session', async () => {
    const mfaToken = signToken(
      { subject: USER_ID, email: USER_EMAIL, mfaPending: true },
      process.env.JWT_SECRET as string,
    );

    const response = await request(harness.app.getHttpServer())
      .post('/auth/extension/authorize')
      .set('Authorization', `Bearer ${mfaToken}`)
      .send({ codeChallenge: CODE_CHALLENGE, redirectUri: REDIRECT_URI });

    expect(response.status).toBe(401);
    expect(
      harness.extensionAuthServiceMock.authorizeExtension,
    ).not.toHaveBeenCalled();
  });

  it('mints a code for a bearer token the strategy accepts', async () => {
    const response = await request(harness.app.getHttpServer())
      .post('/auth/extension/authorize')
      .set('Authorization', `Bearer ${acceptedToken()}`)
      .send({ codeChallenge: CODE_CHALLENGE, redirectUri: REDIRECT_URI });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      redirectUrl: `${REDIRECT_URI}?code=${CODE}`,
    });
    expect(
      harness.extensionAuthServiceMock.authorizeExtension,
    ).toHaveBeenCalledWith(USER_ID, CODE_CHALLENGE, REDIRECT_URI);
  });
});
