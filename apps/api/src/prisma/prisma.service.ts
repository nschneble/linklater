import * as dotenv from 'dotenv';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { PrismaClient } from './generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

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
 * The pool is capped at 10 connections. With the adapter, the pool size is a
 * `pg.Pool` option; the `connection_limit` query param that Prisma's native
 * engine reads is meaningless to node-postgres, so it must be set here in code.
 * Paired with pg-boss's own pool (`max: 5` in `QueueService`), that is 15
 * backends, comfortably under the production `max_connections = 50`.
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

    const pool = new Pool({ connectionString, max: 10 });
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
