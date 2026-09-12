import type { DataSource } from 'typeorm';

import { ServiceUnavailableException } from '@nestjs/common';
import { expect, test, vi } from 'vitest';

import { HealthController } from '../../src/internal/health.controller';

/** Creates the minimal datasource boundary required by Platform health checks. */
function createDataSource(
  isInitialized: boolean,
  query = vi.fn().mockResolvedValue([{ '?column?': 1 }]),
): DataSource {
  return {
    isInitialized,
    query,
  } as unknown as DataSource;
}

/** Verifies a failed database probe fails the readiness boundary closed. */
async function testFailedReadinessProbe(): Promise<void> {
  const query = vi.fn().mockRejectedValue(new Error('database unavailable'));
  const controller = new HealthController(createDataSource(true, query));

  await expect(controller.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
}

/** Verifies liveness remains independent from database readiness. */
function testHealth(): void {
  const dataSource = createDataSource(false);
  const controller = new HealthController(dataSource);

  expect(controller.getHealth()).toEqual({ service: 'platform-service', status: 'ok' });
  expect(dataSource.query).not.toHaveBeenCalled();
}

/** Verifies readiness uses the shared response contract after a database probe. */
async function testReadiness(): Promise<void> {
  const dataSource = createDataSource(true);
  const controller = new HealthController(dataSource);

  await expect(controller.getReadiness()).resolves.toEqual({
    service: 'platform-service',
    status: 'ready',
  });
  expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
}

/** Verifies an uninitialized datasource fails the readiness boundary closed. */
async function testUninitializedReadiness(): Promise<void> {
  const controller = new HealthController(createDataSource(false));

  await expect(controller.getReadiness()).rejects.toBeInstanceOf(ServiceUnavailableException);
}

test('reports process liveness without database readiness', testHealth);
test('reports readiness after a successful database probe', testReadiness);
test('rejects readiness before datasource initialization', testUninitializedReadiness);
test('rejects readiness when the database probe fails', testFailedReadinessProbe);
