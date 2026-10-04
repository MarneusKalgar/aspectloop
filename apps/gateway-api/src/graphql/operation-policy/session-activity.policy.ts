import { inspectExecutedRootFields } from '../operations/root-field-inspection';
import { getOperationPolicy } from './operation-policy';

/** Classifies executable roots using server-owned metadata and request directive values. */
export function recordsSessionActivity(
  query: string,
  operationName?: null | string,
  variables?: unknown,
): boolean {
  try {
    const selected = inspectExecutedRootFields(query, operationName, variables);

    if (!selected) {
      return false;
    }

    return selected.roots.some(
      (root) => getOperationPolicy(selected.operation, root)?.recordActivity === true,
    );
  } catch {
    return false;
  }
}
