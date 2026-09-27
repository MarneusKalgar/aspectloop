import { OperationTypeNode } from 'graphql';

import { AUTH_OPERATION_POLICIES, type AuthRateLimitPolicy } from './auth-operation.policy';
import {
  CORRECTION_MUTATION_POLICIES,
  CORRECTION_QUERY_POLICIES,
} from './correction-operation.policy';

export interface OperationPolicy {
  readonly rateLimit?: AuthRateLimitPolicy;
  readonly recordActivity?: true;
  readonly requiresSoleRoot?: true;
}

/** Composes feature-owned declarations by GraphQL operation type and root name. */
const OPERATION_POLICIES: Readonly<
  Partial<Record<OperationTypeNode, Readonly<Record<string, OperationPolicy>>>>
> = Object.freeze({
  [OperationTypeNode.MUTATION]: Object.freeze({
    ...AUTH_OPERATION_POLICIES,
    ...CORRECTION_MUTATION_POLICIES,
  }),
  [OperationTypeNode.QUERY]: CORRECTION_QUERY_POLICIES,
});

/** Resolves declared metadata without treating inherited names as operations. */
export function getOperationPolicy(
  operation: OperationTypeNode,
  root: string,
): null | OperationPolicy {
  const policies = OPERATION_POLICIES[operation];

  if (!policies || !Object.hasOwn(policies, root)) {
    return null;
  }

  return policies[root] ?? null;
}
