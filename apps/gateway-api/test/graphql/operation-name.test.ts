import { parse } from 'graphql';
import { expect, test } from 'vitest';

import { getBoundedOperationName } from '../../src/graphql/utils/createGraphqlLoggingPlugin';

/** Verifies operation names are bounded without retaining GraphQL source text. */
function testGraphqlOperationNameContract(): void {
  const namedDocument = parse('query CorrectionInbox { __typename }');
  const anonymousDocument = parse('{ __typename }');

  expect(getBoundedOperationName(namedDocument)).toBe('CorrectionInbox');
  expect(getBoundedOperationName(anonymousDocument)).toBe('<anonymous>');
  expect(getBoundedOperationName(namedDocument, 'x'.repeat(129))).toBe('<invalid>');
}

test('GraphQL operation names are bounded without source text', testGraphqlOperationNameContract);
