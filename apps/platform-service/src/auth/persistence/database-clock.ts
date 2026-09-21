import type { EntityManager } from 'typeorm';

import { AuthDatabaseUnavailableError } from './database.errors';

interface DatabaseClockRow {
  now: unknown;
}

/** Reads PostgreSQL's wall clock for all persisted session decisions. */
export async function readAuthDatabaseNow(manager: EntityManager): Promise<Date> {
  const rows = await manager.query<unknown>('SELECT clock_timestamp() AS "now"');

  if (
    !isDatabaseClockResult(rows) ||
    !(rows[0].now instanceof Date) ||
    Number.isNaN(rows[0].now.getTime())
  ) {
    throw new AuthDatabaseUnavailableError('Invalid authentication database clock response');
  }

  return rows[0].now;
}

/** Narrows an arbitrary query response to the expected database-clock row. */
function isDatabaseClockResult(rows: unknown): rows is [DatabaseClockRow, ...unknown[]] {
  if (!Array.isArray(rows)) {
    return false;
  }

  const firstRow: unknown = rows[0];

  return firstRow !== null && typeof firstRow === 'object' && 'now' in firstRow;
}
