import { Injectable, type OnModuleDestroy } from '@nestjs/common';
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
 * Disconnects the client on shutdown (see `onModuleDestroy`) so the pool
 * drains cleanly on SIGTERM. This only fires when
 * `app.enableShutdownHooks()` is enabled in `main.ts`.
 *
 * @throws {Error} When `DATABASE_URL` is not set in the environment.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set');

    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({ adapter });
  }

  /**
   * Closes the Prisma client (and its underlying `pg.Pool`) so in-flight
   * queries settle and connections are released before the process exits.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
