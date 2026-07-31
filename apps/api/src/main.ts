import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import {
  applySecurityHeaders,
  assertTestingUiNotInProduction,
  CompactLogger,
  parseCorsOrigin,
  validateRequiredEnvVars,
} from './common/index.js';
import { LinksModule } from './links/links.module.js';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request, Response, NextFunction } from 'express';

/**
 * Attempts to load local HTTPS certificates for development. In production
 * (where `NODE_ENV === 'production'`) this always returns `undefined` so the
 * server starts in plain HTTP mode (TLS is handled by the reverse proxy).
 *
 * In development, place your locally-trusted certs at `apps/api/certs/`:
 *   - `localhost-key.pem` – the private key
 *   - `localhost.pem`     – the certificate
 *
 * Use `mkcert localhost` to generate these quickly.
 *
 * @returns The HTTPS options object if both cert files exist, or `undefined`.
 */
function loadHttpsOptions() {
  if (process.env.NODE_ENV === 'production') return undefined;
  const directory = dirname(fileURLToPath(import.meta.url));
  const keyPath = join(directory, '..', 'certs', 'localhost-key.pem');
  const certPath = join(directory, '..', 'certs', 'localhost.pem');
  if (!existsSync(keyPath) || !existsSync(certPath)) return undefined;
  return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}

/**
 * Application entry point. Configures and starts the NestJS HTTP server.
 *
 * Global configuration applied here:
 * - Helmet security headers on every response (see `applySecurityHeaders`).
 * - `ValidationPipe` with `whitelist` and `forbidNonWhitelisted` to reject
 *   unknown DTO fields before they reach the controller.
 * - Chrome Private Network Access header middleware for bookmarklet support
 *   (browsers block public pages from fetching localhost without this header).
 * - CORS with open origin (`*`) by default so the bookmarklet can POST from
 *   any third-party website. Set `CORS_ORIGIN` to restrict this in production;
 *   it accepts a single origin or a comma-separated list of origins (front-end
 *   domain plus extension origins), parsed by `parseCorsOrigin`.
 */
async function bootstrap() {
  validateRequiredEnvVars();
  assertTestingUiNotInProduction();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    httpsOptions: loadHttpsOptions(),
    logger: new CompactLogger(),
  });

  // trust one proxy hop (Caddy); `true` would let a client spoof its req.ip
  app.set('trust proxy', 1);

  // SIGTERM fires OnModuleDestroy so pg-boss drains + Prisma frees its pool
  app.enableShutdownHooks();

  // first in the chain so even later errors carry the security headers
  applySecurityHeaders(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Chrome Private Network Access: lets public pages POST to localhost
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.headers['access-control-request-private-network']) {
      response.setHeader('access-control-allow-private-network', 'true');
    }
    next();
  });

  // open `*` so the bookmarklet can POST from any site; credentials off for `*`
  app.enableCors({
    origin: parseCorsOrigin(process.env.CORS_ORIGIN),
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // scope the spec to LinksModule: the only PAT-reachable endpoints
  const openapiDocument = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Linklater API')
      .setDescription(
        [
          'Save, browse, and stumble through your reading list from outside the Linklater web app – from a browser extension, a script, or your terminal.',
          '',
          'Authenticate every request with a personal access token in the `Authorization` header: `Authorization: Bearer ltk_…`. Create a token under **Settings → API Tokens**; tokens are shown once at creation and can be revoked from the same page.',
          '',
          'All responses are JSON. Successes use the conventional `2xx` status codes (`200` for reads and idempotent updates, `201` for create). Errors return a standard NestJS error body – `{ statusCode, message, error }` – with the matching HTTP status (`400` for invalid input, `401` for a missing or invalid token, `404` for links that do not exist or are not yours).',
        ].join('\n'),
      )
      .setVersion(process.env.npm_package_version ?? '0.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'ltk_…',
          description:
            'Personal access token. Create one in Settings → API Tokens.',
        },
        'pat',
      )
      .build(),
    { include: [LinksModule] },
  );

  // spec isn't sensitive (shapes, not data), so no guard; calls still need a token
  app
    .getHttpAdapter()
    .get('/openapi.json', (_request: Request, response: Response) =>
      response.json(openapiDocument),
    );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
