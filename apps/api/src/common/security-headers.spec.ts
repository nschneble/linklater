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

  // Helmet middleware sets headers on every response, this 404 included
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

  // CORP stays same-origin; cross-origin would only let third parties hotlink
  it('keeps Cross-Origin-Resource-Policy at same-origin', async () => {
    const response = await request(app.getHttpServer()).get('/any-path');

    expect(response.headers['cross-origin-resource-policy']).toBe(
      'same-origin',
    );
  });
});
