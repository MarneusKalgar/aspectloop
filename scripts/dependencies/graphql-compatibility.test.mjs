import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';

const repositoryUrl = new URL('../../', import.meta.url);
const require = createRequire(new URL('package.json', repositoryUrl));
const SENTINEL = '__aspectloopMergeRegression__';
const QUERY = /* GraphQL */ `
  query Fields($include: Boolean! = true, $skip: Boolean! = true) {
    node {
      ...Outer
    }
  }
  fragment Outer on Node {
    ...Visible @include(if: $include)
    hidden @skip(if: $skip)
  }
  fragment Visible on Node {
    label
  }
`;

/**
 * Exercises ordinary GraphQL-16 directives through the installed delegation dependencies.
 *
 * @returns {Promise<void>} Resolves after variable, default, fragment, and literal directive controls.
 */
async function checksDelegatedDirectives() {
  const { wrapSchema } = require('@graphql-tools/wrap');
  const { graphql } = require('graphql');
  const schema = wrapSchema({ schema: createControlSchema() });
  const defaults = await graphql({ schema, source: QUERY });
  const overrides = await graphql({
    schema,
    source: QUERY,
    variableValues: { include: false, skip: false },
  });
  const literals = await graphql({
    schema,
    source: '{ node { label @include(if: true) hidden @skip(if: true) } }',
  });

  assert.deepEqual(JSON.parse(JSON.stringify(defaults)), { data: { node: { label: 'visible' } } });
  assert.deepEqual(JSON.parse(JSON.stringify(overrides)), { data: { node: { hidden: 'secret' } } });
  assert.deepEqual(JSON.parse(JSON.stringify(literals)), { data: { node: { label: 'visible' } } });
}

/**
 * Exercises every locked utils copy, including the modules used by Nest and codegen.
 *
 * @returns {Promise<void>} Resolves after CommonJS and ESM security/control assertions.
 */
async function checksEveryMergeBoundary() {
  const lockfile = JSON.parse(readFileSync(new URL('package-lock.json', repositoryUrl), 'utf8'));
  let copies = 0;

  for (const [path, metadata] of Object.entries(lockfile.packages)) {
    if (!path.endsWith('node_modules/@graphql-tools/utils')) {
      continue;
    }

    const [major, minor, patch] = metadata.version.split('.').map(Number);

    assert.ok(major > 12 || (major === 12 && (minor > 0 || patch >= 1)), path);

    const packageUrl = new URL(`${path}/package.json`, repositoryUrl);
    const localRequire = createRequire(packageUrl);
    const commonJs = localRequire('@graphql-tools/utils');
    const esm = await import(new URL('esm/index.js', packageUrl).href);

    checksMergeControl(commonJs.mergeDeep, `${path} CommonJS`);
    checksMergeControl(esm.mergeDeep, `${path} ESM`);
    copies += 1;
  }

  assert.ok(copies > 0, 'the test must exercise installed utils copies');
}

/**
 * Rejects prototype-sensitive keys at root and recursive merge boundaries without leaking pollution.
 *
 * @param {(sources: object[]) => object} mergeDeep Installed merge implementation.
 * @param {string} boundary Package path and module format for assertion messages.
 * @returns {void} Asserts malicious inputs and ordinary nested merge behavior.
 */
function checksMergeControl(mergeDeep, boundary) {
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, SENTINEL);
  const attack = JSON.parse(
    `{"__proto__":{"${SENTINEL}":true},"constructor":{"prototype":{"${SENTINEL}":true}},"prototype":{"${SENTINEL}":true},"allowed":"value"}`,
  );

  try {
    const root = mergeDeep([{}, attack]);
    const nested = mergeDeep([{ nested: {} }, { nested: attack }]);

    assert.deepEqual(
      Object.getOwnPropertyDescriptor(Object.prototype, SENTINEL),
      previous,
      boundary,
    );
    assert.deepEqual(root, { allowed: 'value' }, boundary);
    assert.deepEqual(nested, { nested: { allowed: 'value' } }, boundary);
    assert.deepEqual(
      mergeDeep([{ node: { count: 1, label: 'visible' } }, { node: { count: 2 } }]),
      { node: { count: 2, label: 'visible' } },
      boundary,
    );
  } finally {
    if (previous) {
      Object.defineProperty(Object.prototype, SENTINEL, previous);
    } else {
      delete Object.prototype[SENTINEL];
    }
  }
}

/**
 * Exercises Yoga's actual installed executor through its HTTP boundary with both directive outcomes.
 *
 * @returns {Promise<void>} Resolves after successful default and overridden-variable responses.
 */
async function checksYogaDirectives() {
  const { createYoga } = require('graphql-yoga');
  const yoga = createYoga({ logging: false, schema: createControlSchema() });

  for (const variables of [undefined, { include: false, skip: false }]) {
    const response = await yoga.fetch('http://gateway.test/graphql', {
      body: JSON.stringify({ query: QUERY, variables }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      data: { node: variables ? { hidden: 'secret' } : { label: 'visible' } },
    });
  }
}

/**
 * Creates an ordinary local schema without adding a runtime stitching boundary to the application.
 *
 * @returns {import('graphql').GraphQLSchema} Schema used by the compatibility controls.
 */
function createControlSchema() {
  const { makeExecutableSchema } = require('@graphql-tools/schema');

  return makeExecutableSchema({
    resolvers: {
      Query: {
        /**
         * Supplies distinguishable fields so directive mistakes change the asserted result.
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
}

test(
  'every installed utils copy guards dangerous merge keys and preserves ordinary merges',
  checksEveryMergeBoundary,
);
test(
  'delegation preserves GraphQL-16 variable directives, defaults, nested fragments and literals',
  checksDelegatedDirectives,
);
test(
  'Yoga preserves directive variables and defaults through its HTTP executor',
  checksYogaDirectives,
);
