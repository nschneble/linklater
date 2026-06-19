import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { CompactLogger } from './common/compact-logger.js';
import { assertTestingUiNotInProduction } from './common/testing-ui.js';
import { LinksModule } from './links/links.module.js';
import type { Request, Response, NextFunction } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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
 * Validates that required environment variables are set. Exits the process
 * immediately with a clear diagnostic if any are missing – better to fail at
 * startup than to discover a missing key during a live request.
 */
function validateRequiredEnvVars() {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'TOTP_ENCRYPTION_KEY'];

  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    console.error(
      `[startup] Missing required environment variables: ${missing.join(', ')}`,
    );
    process.exit(1);
  }

  if (!/^[0-9a-fA-F]{64}$/.test(process.env.TOTP_ENCRYPTION_KEY ?? '')) {
    console.error(
      '[startup] TOTP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)',
    );
    process.exit(1);
  }
}

/**
 * Application entry point. Configures and starts the NestJS HTTP server.
 *
 * Global configuration applied here:
 * - `ValidationPipe` with `whitelist` and `forbidNonWhitelisted` to reject
 *   unknown DTO fields before they reach the controller.
 * - Chrome Private Network Access header middleware for bookmarklet support
 *   (browsers block public pages from fetching localhost without this header).
 * - CORS with open origin (`*`) by default so the bookmarklet can POST from
 *   any third-party website. Set `CORS_ORIGIN` to restrict this in production.
 */
async function bootstrap() {
  validateRequiredEnvVars();
  assertTestingUiNotInProduction();
  const app = await NestFactory.create(AppModule, {
    httpsOptions: loadHttpsOptions(),
    logger: new CompactLogger(),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Chrome Private Network Access: public pages (e.g. third-party sites
  // where the bookmarklet runs) need this response header to be allowed
  // to POST to localhost by Chrome's Private Network Access policy.
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.headers['access-control-request-private-network']) {
      response.setHeader('access-control-allow-private-network', 'true');
    }
    next();
  });

  // CORS is intentionally open (`*`) by default so the bookmarklet can POST
  // from any website. In production set `CORS_ORIGIN` to the union of the
  // front-end domain and any extension origins
  // (`chrome-extension://<id>`, `moz-extension://<id>`, etc.) – bookmarklets
  // are an Origin-less navigation in modern browsers and keep working under
  // a restricted CORS policy. `credentials: false` is required when
  // `origin: '*'` and is harmless under a restricted origin since the API
  // uses JWT Bearer tokens, not cookies.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // Build the OpenAPI document for the Linklater API. Intentionally scoped to
  // LinksModule – these are the only endpoints reachable with a personal
  // access token (PAT), and the public docs page should describe exactly that
  // surface and nothing else. Session-only routes (/auth, /users, /tokens)
  // keep their decorators internally but are deliberately excluded from the
  // user-facing spec.
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

  // Expose the spec at /openapi.json. The schema itself is not sensitive (it
  // documents shapes, not data), so no guard is applied. The endpoints it
  // describes still require a valid token to call.
  app
    .getHttpAdapter()
    .get('/openapi.json', (_request: Request, response: Response) =>
      response.json(openapiDocument),
    );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
