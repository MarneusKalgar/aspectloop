import { EntityManager } from 'typeorm';

const CORRECTION_LOCK_TIMEOUT_MS = 10_000;
const CORRECTION_STATEMENT_TIMEOUT_MS = 30_000;

/**
 * Applies transaction-local database timeouts for the correction submit flow.
 */
export async function applyTransactionTimeouts(manager: EntityManager): Promise<void> {
  await manager.query(`SET LOCAL statement_timeout = ${CORRECTION_STATEMENT_TIMEOUT_MS}`);
  await manager.query(`SET LOCAL lock_timeout = ${CORRECTION_LOCK_TIMEOUT_MS}`);
}
