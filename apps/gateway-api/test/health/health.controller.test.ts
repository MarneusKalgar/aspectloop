import type { PlatformClient } from '@gateway/platform/platform-client';

import { GATEWAY_SERVICE_NAME } from '@gateway/core/service-name';
import { expect, test, vi } from 'vitest';

import { HealthController } from '../../src/health/health.controller';

/** Creates the minimal Platform facade required by gateway health probes. */
function createPlatformClient(getReadiness: PlatformClient['getReadiness']): PlatformClient {
  return { getReadiness } as unknown as PlatformClient;
}

/** Verifies liveness remains independent from Platform readiness. */
function testHealth(): void {
  const getReadiness = vi.fn<PlatformClient['getReadiness']>();
  const controller = new HealthController(createPlatformClient(getReadiness));

  expect(controller.getHealth()).toEqual({ service: 'gateway-api', status: 'ok' });
  expect(getReadiness).not.toHaveBeenCalled();
}

/** Verifies readiness succeeds only after the Platform probe succeeds. */
async function testReadiness(): Promise<void> {
  const getReadiness = vi.fn<PlatformClient['getReadiness']>().mockResolvedValue({
    service: 'platform-service',
    status: 'ready',
  });
  const controller = new HealthController(createPlatformClient(getReadiness));

  await expect(controller.getReadiness()).resolves.toEqual({
    service: 'gateway-api',
    status: 'ready',
  });
  expect(getReadiness).toHaveBeenCalledOnce();
}

/** Verifies Platform failures make the gateway readiness probe fail closed. */
async function testReadinessFailure(): Promise<void> {
  const failure = new Error('Platform unavailable');
  const getReadiness = vi.fn<PlatformClient['getReadiness']>().mockRejectedValue(failure);
  const controller = new HealthController(createPlatformClient(getReadiness));

  await expect(controller.getReadiness()).rejects.toBe(failure);
}

test('reports process liveness without probing Platform', testHealth);
test('reports readiness after Platform is ready', testReadiness);
test('rejects readiness when Platform is unavailable', testReadinessFailure);

/** Pins the literal health wire value independently of the shared constant. */
function testGatewayServiceWireName(): void {
  expect(GATEWAY_SERVICE_NAME).toBe('gateway-api');
}

test('keeps the Gateway wire service name literal', testGatewayServiceWireName);
