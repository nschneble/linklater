import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';

/**
 * The shape returned by a successful health check. `status` is a coarse
 * liveness signal; `database` reports whether the primary datastore answered
 * a trivial probe query.
 */
export interface HealthStatus {
  status: 'ok';
  database: 'up';
}

/**
 * Answers the unauthenticated `GET /health` probe used by container
 * orchestrators (docker-compose healthchecks, deploy workflows). The check is
 * deliberately cheap: a single `SELECT 1` round-trip that confirms the process
 * can reach and query PostgreSQL without touching application tables.
 */
@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Confirms database connectivity with a trivial `SELECT 1`.
   *
   * @returns The health status when the database answers.
   *
   * @throws {ServiceUnavailableException} When the database probe fails, so
   *   the endpoint responds with `503` and orchestrators mark the container
   *   unhealthy rather than routing traffic to it.
   */
  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
      });
    }

    return { status: 'ok', database: 'up' };
  }
}
