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
});
