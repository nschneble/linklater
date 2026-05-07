import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
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
  const app = await NestFactory.create(AppModule, {
    httpsOptions: loadHttpsOptions(),
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
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
