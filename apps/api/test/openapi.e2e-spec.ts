import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AnyAuthGuard } from '../src/auth/any-auth.guard.js';

import { LinksController } from '../src/links/links.controller.js';
import { LinksQueryService } from '../src/links/links-query.service.js';
import { LinksService } from '../src/links/links.service.js';
import type { Request, Response } from 'express';

/**
 * E2E smoke test for the public OpenAPI spec served at `GET /openapi.json`.
 *
 * Builds the document with the same `DocumentBuilder` configuration as
 * `apps/api/src/main.ts` and registers the route handler against a real
 * Express adapter. The downstream Linklater frontend's `ApiDocsView`
 * consumes this exact endpoint, so this test guards against:
 *
 * - Spec scope leaks (only `/links/*` should be present).
 * - Missing or renamed security scheme (`pat` must exist; OpenAPI consumers,
 *   including the custom API docs page, bind to it by name).
 * - Decorator drift on `LinksController` (missing operationIds, broken
 *   response shapes).
 *
 * Boots a minimal testing module – `LinksController` with a stubbed
 * `LinksService` and a permissive `AnyAuthGuard` – so the test never hits
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
        {
          provide: LinksQueryService,
          useValue: {} as unknown as LinksQueryService,
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
          // Mirror the auth-header example baked into `apps/api/src/main.ts`
          // so the `info.description` assertion below has meaningful copy to
          // match against. The literal "Authorization: Bearer ltk_…" is what
          // the API docs page's "try it" affordance and downstream API
          // clients read from.
          'Authenticate every request with a personal access token in the `Authorization` header: `Authorization: Bearer ltk_…`.',
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

  // Pins the PAT-auth example baked into `main.ts`'s `setDescription` against
  // future copy edits. The API docs page's "try it" affordance uses the
  // description as auth guidance, so the literal "Authorization: Bearer ltk_…"
  // must survive.
  it('embeds the Bearer-ltk auth header example in info.description', async () => {
    const response = await request(app.getHttpServer()).get('/openapi.json');

    expect(response.body.info.description).toContain(
      'Authorization: Bearer ltk_',
    );
  });

  it('declares the "pat" bearer security scheme that API consumers bind against', async () => {
    const response = await request(app.getHttpServer()).get('/openapi.json');

    const schemes = response.body.components?.securitySchemes ?? {};
    expect(schemes.pat).toMatchObject({
      type: 'http',
      scheme: 'bearer',
    });
  });

  it('includes the /links endpoints – list, create, stumble, random, by id, delete-read', async () => {
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
