import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import { CompactLogger } from './compact-logger.js';
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
 *   - `localhost-key.pem` — the private key
 *   - `localhost.pem`     — the certificate
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
 * immediately with a clear diagnostic if any are missing — better to fail at
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

  // GOTCHA: CORS is intentionally open (`*`) by default so the bookmarklet
  // can POST from any website. In production you should set CORS_ORIGIN to
  // your front-end domain. Note that `credentials: false` is required when
  // `origin: '*'` — cookies are not used here (we use JWT Bearer tokens).
  //
  // TODO (extension PATs): once the browser-extension PAT flow firms up
  // and the production extension origins are known
  // (chrome-extension://<id>, moz-extension://<id>, etc.), narrow CORS_ORIGIN
  // to the union of { frontend domain, extension origins } and drop the
  // wildcard. Bookmarklets are an Origin-less navigation in modern browsers
  // and will keep working under a restricted CORS policy.
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
