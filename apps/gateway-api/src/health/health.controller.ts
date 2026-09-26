import { Controller, Get } from '@nestjs/common';

import { GATEWAY_SERVICE_NAME } from '#app/core/service-name';
import { PlatformClient } from '#app/platform/platform-client';

interface GatewayHealthResponse {
  service: typeof GATEWAY_SERVICE_NAME;
  status: 'ok';
}

interface GatewayReadinessResponse {
  service: typeof GATEWAY_SERVICE_NAME;
  status: 'ready';
}

/** Separates gateway process liveness from readiness of its Platform dependency. */
@Controller('health')
export class HealthController {
  /** Creates gateway health probes over required downstream dependencies. */
  constructor(private readonly platformClient: PlatformClient) {}

  /** Reports process liveness without probing downstream services. */
  @Get()
  getHealth(): GatewayHealthResponse {
    return { service: GATEWAY_SERVICE_NAME, status: 'ok' };
  }

  /** Reports readiness only after the required Platform dependency is ready. */
  @Get('readiness')
  async getReadiness(): Promise<GatewayReadinessResponse> {
    await this.platformClient.getReadiness();

    return { service: GATEWAY_SERVICE_NAME, status: 'ready' };
  }
}
