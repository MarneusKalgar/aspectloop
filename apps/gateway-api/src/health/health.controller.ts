import { Controller, Get } from '@nestjs/common';

import { PlatformClient } from '../platform/platform-client';

interface GatewayHealthResponse {
  service: 'gateway-api';
  status: 'ok';
}

interface GatewayReadinessResponse {
  service: 'gateway-api';
  status: 'ready';
}

@Controller('health')
export class HealthController {
  /** Creates gateway health probes over required downstream dependencies. */
  constructor(private readonly platformClient: PlatformClient) {}

  /** Reports process liveness without probing downstream services. */
  @Get()
  getHealth(): GatewayHealthResponse {
    return { service: 'gateway-api', status: 'ok' };
  }

  /** Reports readiness only after the required Platform dependency is ready. */
  @Get('readiness')
  async getReadiness(): Promise<GatewayReadinessResponse> {
    await this.platformClient.getReadiness();

    return { service: 'gateway-api', status: 'ready' };
  }
}
