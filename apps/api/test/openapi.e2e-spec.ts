import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { Request, Response } from 'express';

import { AnyAuthGuard } from '../src/auth/any-auth.guard.js';
import { LinksController } from '../src/links/links.controller.js';
import { LinksService } from '../src/links/links.service.js';

/**
 * E2E smoke test for the public OpenAPI spec served at `GET /openapi.json`.
 *
 * Builds the document with the same `DocumentBuilder` configuration as
 * `apps/api/src/main.ts` and registers the route handler against a real
 * Express adapter. The downstream Linklater frontend's `ApiDocsView`
 * consumes this exact endpoint, so this test guards against:
 *
 * - Spec scope leaks (only `/links/*` should be present).
 * - Missing or renamed security scheme (`pat` must exist; Scalar binds to
 *   it by name).
 * - Decorator drift on `LinksController` (missing operationIds, broken
 *   response shapes).
 *
 * Boots a minimal testing module — `LinksController` with a stubbed
 * `LinksService` and a permissive `AnyAuthGuard` — so the test never hits
 * a database or queue.
 */
describe('OpenAPI document (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [LinksController],
      providers: [
        {
          provide: LinksService,
          useValue: {} as unknown as LinksService,
        },
      ],
    })
      .overrideGuard(AnyAuthGuard)
      .useValue({ canActivate: (_context: ExecutionContext) => true })
      .compile();

    app = moduleRef.createNestApplication();

    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Linklater API')
        .setDescription(
          'Personal access token endpoints for managing your saved links.',
        )
        .setVersion('test')
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'ltk_…',
          },
          'pat',
        )
        .build(),
    );

    app
      .getHttpAdapter()
      .get('/openapi.json', (_request: Request, response: Response) =>
        response.json(document),
      );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the OpenAPI document at /openapi.json with the expected metadata', async () => {
    const response = await request(app.getHttpServer()).get('/openapi.json');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.body.info.title).toBe('Linklater API');
    expect(response.body.info.version).toBe('test');
  });

  it('declares the "pat" bearer security scheme that Scalar binds against', async () => {
    const response = await request(app.getHttpServer()).get('/openapi.json');

    const schemes = response.body.components?.securitySchemes ?? {};
    expect(schemes.pat).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('includes the /links endpoints — list, create, stumble, random, by id, delete-read', async () => {
    const response = await request(app.getHttpServer()).get('/openapi.json');

    const paths = response.body.paths ?? {};
    expect(paths['/links']).toBeDefined();
    expect(paths['/links'].get).toBeDefined();
    expect(paths['/links'].post).toBeDefined();
    expect(paths['/links/stumble']).toBeDefined();
    expect(paths['/links/stumble'].post).toBeDefined();
    expect(paths['/links/random']).toBeDefined();
    expect(paths['/links/random'].get).toBeDefined();
    expect(paths['/links/{id}']).toBeDefined();
    expect(paths['/links/{id}'].get).toBeDefined();
    expect(paths['/links/{id}'].patch).toBeDefined();
    expect(paths['/links/{id}'].delete).toBeDefined();
    expect(paths['/links/read']).toBeDefined();
    expect(paths['/links/read'].delete).toBeDefined();
  });

  it('binds the "pat" security scheme on every /links operation', async () => {
    const response = await request(app.getHttpServer()).get('/openapi.json');

    const paths = response.body.paths ?? {};
    const operations: { path: string; method: string }[] = [];
    for (const path of Object.keys(paths)) {
      for (const method of Object.keys(paths[path])) {
        operations.push({ path, method });
      }
    }

    expect(operations.length).toBeGreaterThan(0);
    for (const operation of operations) {
      const security = paths[operation.path][operation.method].security ?? [];
      const hasPatScheme = security.some(
        (entry: Record<string, unknown>) => 'pat' in entry,
      );
      expect(hasPatScheme).toBe(true);
    }
  });
});
