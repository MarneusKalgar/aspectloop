import {
  PLATFORM_INTERNAL_API_PREFIX,
  type PlatformHealthResponse,
  platformHealthResponseSchema,
  type PlatformReadinessResponse,
  platformReadinessResponseSchema,
} from '@aspectloop/contracts/platform';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller(PLATFORM_INTERNAL_API_PREFIX.slice(1))
export class HealthController {
  /** Creates health checks over the service-owned datasource. */
  constructor(private readonly dataSource: DataSource) {}

  /** Returns process liveness without querying a downstream dependency. */
  @Get('health')
  getHealth(): PlatformHealthResponse {
    return platformHealthResponseSchema.parse({
      service: 'platform-service',
      status: 'ok',
    });
  }

  /** Returns readiness only after the Platform datasource has initialized. */
  @Get('readiness')
  async getReadiness(): Promise<PlatformReadinessResponse> {
    if (!this.dataSource.isInitialized) {
      throw new ServiceUnavailableException('Platform service is not ready');
    }

    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Platform service is not ready');
    }

    return platformReadinessResponseSchema.parse({
      service: 'platform-service',
      status: 'ready',
    });
  }
}
