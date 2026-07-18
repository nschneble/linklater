import { Injectable, ServiceUnavailableException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { QueueService } from '../queue/queue.service.js';

/**
 * The shape returned by a successful health check. `status` is a coarse
 * liveness signal; `database` reports whether the primary datastore answered
 * a trivial probe query; `queue` reports whether the pg-boss background-job
 * subsystem is started and polling.
 */
export interface HealthStatus {
  status: 'ok';
  database: 'up';
  queue: 'up' | 'down';
}

/**
 * Answers the unauthenticated `GET /health` probe used by container
 * orchestrators (docker-compose healthchecks, deploy workflows). The check is
 * deliberately cheap: a single `SELECT 1` round-trip that confirms the process
 * can reach and query PostgreSQL, plus an in-memory read of the pg-boss run
 * state — no extra query. Neither touches application tables.
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  /**
   * Confirms database connectivity with a trivial `SELECT 1` and reports
   * whether the background-job queue is running.
   *
   * The database probe gates the HTTP status: a failure throws `503`. The
   * queue signal is reported but does NOT fail the probe — a stopped queue
   * still surfaces in the body (`queue: 'down'`) for observability without
   * flapping deploys on a transient background-job hiccup, which would be worse
   * than the gap it closes.
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

    return {
      status: 'ok',
      database: 'up',
      queue: this.queue.isRunning() ? 'up' : 'down',
    };
  }
}
