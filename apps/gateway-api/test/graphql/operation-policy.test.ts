import { inspectMutationRoots } from '@gateway/graphql/request-protection/mutation-root-inspection';
import {
  AUTH_OPERATION_NAME,
  AUTH_OPERATION_POLICIES,
  AUTH_RATE_LIMIT_GROUP,
  AUTH_RATE_LIMIT_POLICIES,
  getOperationProtectionPolicy,
} from '@gateway/graphql/request-protection/operation-policy';
import { expect, test } from 'vitest';

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
  const signInPolicy = getOperationProtectionPolicy(AUTH_OPERATION_NAME.SIGN_IN);
  expect(signInPolicy).toEqual({
    rateLimit: AUTH_RATE_LIMIT_POLICIES.SIGN_IN,
    requiresSoleRoot: true,
  });
  expect(signInPolicy?.rateLimit).toBe(AUTH_RATE_LIMIT_POLICIES.SIGN_IN);
  expect(getOperationProtectionPolicy(AUTH_OPERATION_NAME.SIGN_OUT)).toEqual({
    requiresSoleRoot: true,
  });
  const signUpPolicy = getOperationProtectionPolicy(AUTH_OPERATION_NAME.SIGN_UP);
  const resendPolicy = getOperationProtectionPolicy(AUTH_OPERATION_NAME.RESEND_EMAIL_CONFIRMATION);
  expect(signUpPolicy).toEqual({
    rateLimit: AUTH_RATE_LIMIT_POLICIES.REGISTRATION,
  });
  expect(resendPolicy).toEqual({
    rateLimit: AUTH_RATE_LIMIT_POLICIES.REGISTRATION,
  });
  expect(signUpPolicy?.rateLimit).toBe(resendPolicy?.rateLimit);
  expect(getOperationProtectionPolicy(AUTH_OPERATION_NAME.CONFIRM_EMAIL)).toEqual({
    rateLimit: AUTH_RATE_LIMIT_POLICIES.CONFIRMATION,
  });
  expect(getOperationProtectionPolicy('toString')).toBeNull();
  expect(getOperationProtectionPolicy('__proto__')).toBeNull();
  expect(getOperationProtectionPolicy('submitCorrections')).toBeNull();
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

test('inspects selected mutation roots through aliases and fragments', testSelectedMutationRoots);
test('maps operation metadata without inherited-name matches', testOperationPolicyLookup);
