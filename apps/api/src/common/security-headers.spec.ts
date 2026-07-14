import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';

import { applySecurityHeaders } from './security-headers.js';

describe('applySecurityHeaders', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleReference: TestingModule = await Test.createTestingModule(
      {},
    ).compile();

    app = moduleReference.createNestApplication();
    applySecurityHeaders(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // Helmet is Express middleware, so its headers ride on every response —
  // including this 404. No route needed to prove the wiring.
  it('sets security headers on every response', async () => {
    const response = await request(app.getHttpServer()).get('/any-path');

    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['strict-transport-security']).toContain('max-age');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  });

  it('strips the X-Powered-By fingerprint header', async () => {
    const response = await request(app.getHttpServer()).get('/any-path');

    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  // Deliberate: CORP stays at helmet's `same-origin` default. CORP only gates
  // no-cors embedding (<img>, <script src>); every real API consumer — the
  // bookmarklet's fetch, the dev frontend, extensions — uses cors-mode
  // requests governed by the CORS policy in main.ts, which CORP never
  // touches. Loosening this to `cross-origin` would only permit third-party
  // pages to hotlink API responses. Do not "fix" without a consumer that
  // genuinely embeds API resources no-cors.
  it('keeps Cross-Origin-Resource-Policy at same-origin', async () => {
    const response = await request(app.getHttpServer()).get('/any-path');

    expect(response.headers['cross-origin-resource-policy']).toBe(
      'same-origin',
    );
  });
});
