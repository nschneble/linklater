import { jest } from '@jest/globals';

import {
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';

import { AnyAuthGuard } from '../auth/any-auth.guard';
import { CustomThrottlerGuard } from '../auth/custom-throttler.guard';
import { LinksController } from './links.controller';
import { LinksQueryService } from './links-query.service';
import { LinksService } from './links.service';
import { SuggestionsController } from '../suggestions/suggestions.controller';
import { SuggestionsService } from '../suggestions/suggestions.service';

/**
 * Proves the query-validation WIRING for the three list endpoints that bind a
 * validated query DTO: `GET /links` (ListLinksQueryDto), `GET /links/random`
 * (RandomLinkQueryDto), and `GET /suggestions` (SuggestionsQueryDto).
 *
 * Each DTO's own `.spec.ts` proves it rejects bad input when run through the
 * pipe directly. The gap this closes: that the `@Query() query: SomeDto`
 * binding on the real controller method actually routes live HTTP request
 * params through the global `ValidationPipe`, so a malformed query yields
 * `400` instead of a `NaN`-to-`500` blow-up. A regression that reverts a
 * `@Query()` param type back to a plain object, or drops the global pipe,
 * would pass every existing unit test but fail here.
 *
 * This is a `*.spec.ts` (not an `.e2e-spec.ts`) on purpose: CI runs the
 * `npm run test` suite but not `test:e2e`, so the guard only has teeth here.
 * It boots a real HTTP server (mirroring `security-headers.spec.ts`) with the
 * two controllers, stubbed services, and permissive guards, which run before
 * pipes, so without the overrides every request would 401/429 before
 * validation. The `ValidationPipe` options are kept byte-identical to
 * `apps/api/src/main.ts`, so this exercises the transform + validation the
 * real app applies.
 */
describe('Query validation wiring', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleReference: TestingModule = await Test.createTestingModule({
      controllers: [LinksController, SuggestionsController],
      providers: [
        { provide: LinksService, useValue: {} as unknown as LinksService },
        {
          provide: LinksQueryService,
          useValue: {
            findAll: jest.fn(async () => ({
              links: [],
              total: 0,
              page: 1,
              limit: 10,
            })),
            getRandom: jest.fn(async () => null),
          } as unknown as LinksQueryService,
        },
        {
          provide: SuggestionsService,
          useValue: {
            getSuggestions: jest.fn(async () => ({
              sourceName: 'Test',
              suggestions: [],
            })),
          } as unknown as SuggestionsService,
        },
      ],
    })
      // guards run before pipes: attach a user for valid-query handlers
      .overrideGuard(AnyAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const httpRequest = context
            .switchToHttp()
            .getRequest<Request & { user: { userId: string } }>();
          httpRequest.user = { userId: 'test-user' };
          return true;
        },
      })
      // override the POST /links throttler; avoids booting ThrottlerModule
      .overrideGuard(CustomThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleReference.createNestApplication();

    // byte-identical to `apps/api/src/main.ts`'s global pipe
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects a non-integer page on GET /links with 400', async () => {
    const response = await request(app.getHttpServer()).get('/links?page=abc');
    expect(response.status).toBe(400);
  });

  it('rejects a non-boolean read on GET /links/random with 400', async () => {
    const response = await request(app.getHttpServer()).get(
      '/links/random?read=garbage',
    );
    expect(response.status).toBe(400);
  });

  it('rejects an out-of-range count on GET /suggestions with 400', async () => {
    const response = await request(app.getHttpServer()).get(
      '/suggestions?count=99',
    );
    expect(response.status).toBe(400);
  });

  // positive controls: a valid query must NOT 400, proving validation fires
  it('accepts a valid page on GET /links', async () => {
    const response = await request(app.getHttpServer()).get('/links?page=2');
    expect(response.status).toBe(200);
  });

  it('accepts a valid read on GET /links/random', async () => {
    const response = await request(app.getHttpServer()).get(
      '/links/random?read=true',
    );
    expect(response.status).toBe(200);
  });

  it('accepts a valid count on GET /suggestions', async () => {
    const response = await request(app.getHttpServer()).get(
      '/suggestions?count=3',
    );
    expect(response.status).toBe(200);
  });
});
