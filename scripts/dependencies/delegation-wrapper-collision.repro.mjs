/**
 * Deferred upstream delegate-12.2.0 defect, human-confirmed on 2026-10-07.
 *
 * Run explicitly: node scripts/dependencies/delegation-wrapper-collision.repro.mjs
 * Expected today: a failing assertion with missing $coerced/$sources variable errors.
 * The assertion describes correct behavior; it is not an expected-error control.
 * This standalone reproducer is intentionally separate from the ordinary suite.
 * Current gateway execution is schema-first, without delegation; codegen loads
 * schema metadata rather than executing these application operations.
 * Owner: repository dependency maintainers. Revisit on the next delegate update,
 * or before adding application runtime delegation, whichever comes first.
 * Upstream: graphql-hive/gateway, packages/delegate/src/getCoercedVariableValues.ts.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(new URL('../../package.json', import.meta.url));

/**
 * Retains the legal variable-name regression as an executable, intentionally failing reproducer.
 *
 * @returns {Promise<void>} Resolves only after an upstream fix restores the correct result.
 */
async function reproducesWrapperVariableNames() {
  const { makeExecutableSchema } = require('@graphql-tools/schema');
  const { wrapSchema } = require('@graphql-tools/wrap');
  const { graphql } = require('graphql');
  const localSchema = makeExecutableSchema({
    resolvers: {
      Query: {
        /**
         * Supplies distinguishable fields so the directive result is unambiguous.
         *
         * @returns {{ label: string, hidden: string }} Control node.
         */
        node() {
          return { hidden: 'secret', label: 'visible' };
        },
      },
    },
    typeDefs: 'type Query { node: Node! } type Node { label: String! hidden: String! }',
  });
  const result = await graphql({
    schema: wrapSchema({ schema: localSchema }),
    source: `query($coerced: Boolean!, $sources: Boolean!) {
      node { label @include(if: $coerced) hidden @skip(if: $sources) }
    }`,
    variableValues: { coerced: true, sources: true },
  });

  assert.deepEqual(JSON.parse(JSON.stringify(result)), { data: { node: { label: 'visible' } } });
}

test(
  'deferred: delegated variables named coerced and sources retain their values',
  reproducesWrapperVariableNames,
);
