import { inspectSelectedRootFields } from '../operations/root-field-inspection';
import { getOperationPolicy } from './operation-policy';

/** Classifies all roots of the selected operation using server-owned metadata. */
export function recordsSessionActivity(query: string, operationName?: null | string): boolean {
  try {
    const selected = inspectSelectedRootFields(query, operationName);

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
