import { Controller, Get } from '@nestjs/common';

import { HealthService, type HealthStatus } from './health.service.js';

/**
 * Unauthenticated liveness/readiness probe. Intentionally guard-free so that
 * container orchestrators and deploy workflows can poll it without a token.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): Promise<HealthStatus> {
    return this.healthService.check();
  }
}
