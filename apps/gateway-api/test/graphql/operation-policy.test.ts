import {
  AUTH_OPERATION_NAME,
  AUTH_OPERATION_POLICIES,
  AUTH_RATE_LIMIT_GROUP,
  AUTH_RATE_LIMIT_POLICIES,
} from '@gateway/graphql/operation-policy/auth-operation.policy';
import {
  CORRECTION_MUTATION_POLICIES,
  CORRECTION_OPERATION_NAME,
  CORRECTION_QUERY_POLICIES,
} from '@gateway/graphql/operation-policy/correction-operation.policy';
import { getOperationPolicy } from '@gateway/graphql/operation-policy/operation-policy';
import {
  inspectMutationRoots,
  inspectSelectedRootFields,
} from '@gateway/graphql/operations/root-field-inspection';
import { OperationTypeNode } from 'graphql';
import { expect, test } from 'vitest';

/** Ensures invalid fragment references cannot expand forever or manufacture extra roots. */
function testCyclicAndMissingFragments(): void {
  expect(
    inspectMutationRoots('mutation { ...Loop } fragment Loop on Mutation { signOut ...Loop }'),
  ).toEqual(['signOut']);
  expect(inspectMutationRoots('mutation { ...Missing signIn }')).toEqual(['signIn']);
}

/** Keeps operation-specific protections declarative and unknown roots unconfigured. */
function testOperationPolicyLookup(): void {
  expect(Object.isFrozen(AUTH_OPERATION_NAME)).toBe(true);
  expect(Object.isFrozen(AUTH_RATE_LIMIT_GROUP)).toBe(true);
  expect(Object.isFrozen(AUTH_RATE_LIMIT_POLICIES)).toBe(true);
  expect(Object.values(AUTH_RATE_LIMIT_POLICIES).every((policy) => Object.isFrozen(policy))).toBe(
    true,
  );
  expect(Object.isFrozen(AUTH_OPERATION_POLICIES)).toBe(true);
  expect(Object.values(AUTH_OPERATION_POLICIES).every((policy) => Object.isFrozen(policy))).toBe(
    true,
  );
  const signInPolicy = getOperationPolicy(OperationTypeNode.MUTATION, AUTH_OPERATION_NAME.SIGN_IN);
  expect(signInPolicy).toEqual({
    rateLimit: AUTH_RATE_LIMIT_POLICIES.SIGN_IN,
    requiresSoleRoot: true,
  });
  expect(signInPolicy?.rateLimit).toBe(AUTH_RATE_LIMIT_POLICIES.SIGN_IN);
  expect(getOperationPolicy(OperationTypeNode.MUTATION, AUTH_OPERATION_NAME.SIGN_OUT)).toEqual({
    requiresSoleRoot: true,
  });
  const signUpPolicy = getOperationPolicy(OperationTypeNode.MUTATION, AUTH_OPERATION_NAME.SIGN_UP);
  const resendPolicy = getOperationPolicy(
    OperationTypeNode.MUTATION,
    AUTH_OPERATION_NAME.RESEND_EMAIL_CONFIRMATION,
  );
  expect(signUpPolicy).toEqual({
    rateLimit: AUTH_RATE_LIMIT_POLICIES.REGISTRATION,
  });
  expect(resendPolicy).toEqual({
    rateLimit: AUTH_RATE_LIMIT_POLICIES.REGISTRATION,
  });
  expect(signUpPolicy?.rateLimit).toBe(resendPolicy?.rateLimit);
  expect(getOperationPolicy(OperationTypeNode.MUTATION, AUTH_OPERATION_NAME.CONFIRM_EMAIL)).toEqual(
    {
      rateLimit: AUTH_RATE_LIMIT_POLICIES.CONFIRMATION,
    },
  );
  expect(getOperationPolicy(OperationTypeNode.MUTATION, 'toString')).toBeNull();
  expect(getOperationPolicy(OperationTypeNode.MUTATION, '__proto__')).toBeNull();
  expect(getOperationPolicy(OperationTypeNode.MUTATION, 'unknownRoot')).toBeNull();
  expect(getOperationPolicy(OperationTypeNode.QUERY, AUTH_OPERATION_NAME.SIGN_IN)).toBeNull();
  expect(Object.isFrozen(CORRECTION_OPERATION_NAME)).toBe(true);
  expect(Object.isFrozen(CORRECTION_QUERY_POLICIES)).toBe(true);
  expect(Object.isFrozen(CORRECTION_MUTATION_POLICIES)).toBe(true);
  expect(
    getOperationPolicy(OperationTypeNode.QUERY, CORRECTION_OPERATION_NAME.CORRECTION_SESSION),
  ).toEqual({ recordActivity: true });
  expect(
    getOperationPolicy(OperationTypeNode.MUTATION, CORRECTION_OPERATION_NAME.CORRECTION_SESSION),
  ).toBeNull();
}

/** Confirms root inspection follows aliases and fragments without counting child fields. */
function testSelectedMutationRoots(): void {
  const roots = inspectMutationRoots(
    `mutation Selected { login: ${AUTH_OPERATION_NAME.SIGN_IN} ...Mixed }
     mutation Other { ${AUTH_OPERATION_NAME.SIGN_OUT} }
     fragment Mixed on Mutation {
       ... on Mutation { submitCorrections }
     }`,
    'Selected',
  );

  expect(roots).toEqual([AUTH_OPERATION_NAME.SIGN_IN, 'submitCorrections']);
  expect(inspectMutationRoots('query { me { id } }')).toBeNull();
}

/** Confirms shared fragments are collected once while separate aliases remain distinct roots. */
function testSharedFragmentTraversal(): void {
  const query = `
    mutation Selected {
      first: signOut
      ...Outer
      ...Outer
      ... on Mutation { second: signOut }
    }
    mutation Other { signIn }
    fragment Outer on Mutation { ...Middle ...Middle }
    fragment Middle on Mutation { submitCorrections ...Leaf ...Leaf }
    fragment Leaf on Mutation { third: signOut }
  `;

  expect(inspectMutationRoots(query, 'Selected')).toEqual([
    'signOut',
    'submitCorrections',
    'signOut',
    'signOut',
  ]);
  expect(inspectMutationRoots(query, 'Other')).toEqual(['signIn']);
  expect(inspectMutationRoots(query)).toBeNull();
  expect(inspectSelectedRootFields('query { me { id } }')?.roots).toEqual(['me']);
}

test('inspects selected mutation roots through aliases and fragments', testSelectedMutationRoots);
test(
  'bounds shared-fragment traversal while preserving aliases and operation selection',
  testSharedFragmentTraversal,
);
test('does not expand cyclic or missing fragments indefinitely', testCyclicAndMissingFragments);
test('maps operation metadata without inherited-name matches', testOperationPolicyLookup);
