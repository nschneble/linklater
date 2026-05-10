import { Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaClient } from './generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * Application-scoped Prisma client. Extends `PrismaClient` so that NestJS
 * can inject it as a service while keeping the full Prisma query API.
 *
 * Uses the `@prisma/adapter-pg` driver adapter with an underlying `pg.Pool`
 * instead of the default connection string approach. This lets multiple
 * NestJS services share a single connection pool rather than each creating
 * their own connections.
 *
 * @throws {Error} When `DATABASE_URL` is not set in the environment.
 */
@Injectable()
export class PrismaService extends PrismaClient {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });
  }
}
