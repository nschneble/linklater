import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module.js';
import type { Request, Response, NextFunction } from 'express';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

function loadHttpsOptions() {
  if (process.env.NODE_ENV === 'production') return undefined;
  const directory = dirname(fileURLToPath(import.meta.url));
  const keyPath = join(directory, '..', 'certs', 'localhost-key.pem');
  const certPath = join(directory, '..', 'certs', 'localhost.pem');
  if (!existsSync(keyPath) || !existsSync(certPath)) return undefined;
  return { key: readFileSync(keyPath), cert: readFileSync(certPath) };
}

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
  // Chrome Private Network Access: public pages fetching localhost need this header
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (request.headers['access-control-request-private-network']) {
      response.setHeader('access-control-allow-private-network', 'true');
    }
    next();
  });
  // allows any origin so the bookmarklet can POST from third-party websites
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
