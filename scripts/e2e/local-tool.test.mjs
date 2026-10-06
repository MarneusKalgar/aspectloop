import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { HeldResponse } from '../../apps/web/test/e2e-live/support/held-response.ts';
import { LIVE_TOPOLOGY } from '../../apps/web/test/e2e-live/support/live-topology.ts';
import {
  isSafeReportLine,
  liveRunnerEnvironment,
  toolArguments,
} from '../../apps/web/test/e2e-live/support/local-tool.mjs';
import { originalSessionState } from '../../apps/web/test/e2e-live/support/original-session-probe.ts';
import { ResponseGate } from '../../apps/web/test/e2e-live/support/response-gate.ts';
import SafeReporter from '../../apps/web/test/e2e-live/support/safe-reporter.ts';

const id = 'd41be59c-d8eb-4e8c-a5e1-99aab7197f04';

test('original-session probe uses fixed Me without a browser jar or cookie mutation' /**
 * Checks transient synthetic credentials and the fixed gate boundary without any network request.
 * @param {import('node:test').TestContext} context Scoped fetch mock ownership.
 * @returns {Promise<void>}
 */, async (context) => {
  let calls = 0;

  context.mock.method(
    globalThis,
    'fetch',
    /**
     * Returns only synthetic selected identity after checking the closed request shape.
     * @param {string} url Fixed gate URL.
     * @param {RequestInit} options In-memory request options.
     * @returns {Promise<Response>} Synthetic current-session response.
     */
    (url, options) => {
      calls += 1;
      assert.equal(url, LIVE_TOPOLOGY.gate.graphqlUrl);
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.origin, LIVE_TOPOLOGY.web.origin);
      assert.equal(options.headers.cookie === 'aspectloop_session=synthetic-credential', true);
      assert.equal(options.signal instanceof AbortSignal, true);
      assert.deepEqual(JSON.parse(options.body), {
        operationName: 'Me',
        query: 'query Me { me { id } }',
      });

      return Promise.resolve(Response.json({ data: { me: { id } } }));
    },
  );

  assert.equal(await originalSessionState('synthetic-credential', id), 'active');
  assert.equal(calls, 1);
});

test('original-session probe distinguishes invalid session from outage and malformed results' /**
 * A failed transport or auth dependency must never become evidence of successful revocation.
 * @param {import('node:test').TestContext} context Scoped fetch mock ownership.
 * @returns {Promise<void>}
 */, async (context) => {
  let response = Response.json({
    data: null,
    errors: [{ extensions: { code: 'AUTH_SESSION_INVALID' } }],
  });

  context.mock.method(
    globalThis,
    'fetch',
    /**
     * Returns one test-owned response without forwarding any credential.
     * @returns {Promise<Response>} Current synthetic response.
     */
    () => Promise.resolve(response),
  );

  assert.equal(await originalSessionState('synthetic-credential', id), 'invalid');

  for (const rejected of [
    Response.json({
      data: null,
      errors: [{ extensions: { code: 'AUTH_DEPENDENCY_UNAVAILABLE' } }],
    }),
    Response.json({ data: { me: { id: 'unexpected-identity' } } }),
    Response.json({ data: { me: { id } } }, { headers: { 'set-cookie': 'synthetic-tombstone' } }),
    new Response('synthetic-private-parse-failure'),
    new Response('x'.repeat(4097)),
    new Response('', { status: 503 }),
  ]) {
    response = rejected;

    await assert.rejects(
      originalSessionState('synthetic-credential', id),
      /**
       * Checks only safe fixed failure fields, never body, header or native error bytes.
       * @param {Error} error Sanitized probe error.
       * @returns {boolean} Whether raw causes and private diagnostics were discarded.
       */
      (error) =>
        error.message === 'E1 original-session probe failed; details omitted.' &&
        error.cause === undefined,
    );
  }
});

test('original-session probe strips transport diagnostics and never sends a missing credential' /**
 * Prevents secret-bearing native failures from crossing the reporting boundary.
 * @param {import('node:test').TestContext} context Scoped fetch mock ownership.
 * @returns {Promise<void>}
 */, async (context) => {
  const fetchMock = context.mock.method(
    globalThis,
    'fetch',
    /**
     * Rejects with synthetic private diagnostics that must not become a retained cause.
     * @returns {Promise<never>} Controlled transport rejection.
     */
    () => Promise.reject(new Error('synthetic-private-transport')),
  );

  await assert.rejects(originalSessionState(null, id), /credential missing; details omitted/);

  assert.equal(fetchMock.mock.callCount(), 0);

  await assert.rejects(
    originalSessionState('synthetic-credential', id),
    /**
     * Checks only the fixed public error, not the discarded transport error.
     * @param {Error} error Sanitized failure.
     * @returns {boolean} Whether the private cause was removed.
     */
    (error) =>
      error.message === 'E1 original-session probe failed; details omitted.' &&
      error.cause === undefined,
  );
});

test('closed command surface rejects arbitrary actions/IDs and permits exact fixture jobs' /**
 * Checks the closed tool policy without spawning Docker.
 * @returns {void}
 */, () => {
  assert.equal(toolArguments('create', id).at(-1), id);
  assert.equal(toolArguments('cleanup', id).at(-1), id);

  for (const [action, identifier] of [
    ['create', undefined],
    ['cleanup', 'all'],
    ['stop-platform; env', undefined],
    ['check', id],
    ['cleanup', '../'],
  ]) {
    assert.throws(
      /**
       * Attempts an invalid invocation without executing it.
       * @returns {string[]}
       */
      () => toolArguments(action, identifier),
      /E1 tool arguments rejected/,
    );
  }
});

test('safe output accepts statuses and closed failure stages, never private diagnostics' /**
 * Checks the reporting boundary and every allowed cookie stage on failure paths.
 * @returns {void}
 */, () => {
  assert.equal(isSafeReportLine('E1-LIVE-04-TIMEOUT passed'), true);
  assert.equal(isSafeReportLine('E1-LIVE-SUMMARY failed'), true);
  assert.equal(isSafeReportLine('E1-LIVE-COUNTS passed=20 required=20 pending=0'), true);
  assert.equal(isSafeReportLine('E1-LIVE-COUNTS passed=1 required=20 pending=19 private'), false);

  for (const stage of [
    'BOOTSTRAP',
    'LEGACY_CLEANUP',
    'REJECTED_LOGIN',
    'REJECTED_LOGIN_COOKIES',
    'SIGN_IN',
    'ORDINARY_READ',
    'SIGN_OUT',
    'LOGOUT_COOKIES',
    'SIGN_IN_HEADERS',
    'SIGN_OUT_HEADERS',
  ]) {
    assert.equal(isSafeReportLine(`E1-LIVE-09-STAGE ${stage} failed`), true);
  }

  for (const unsafe of [
    'Cookie: private',
    'E1-LIVE-01 failed private',
    'E1-LIVE-01 passed\nsecret',
    'AUTH_DEPENDENCY_UNAVAILABLE',
    'auth-http-id@example.test',
    'E1-LIVE-09-STAGE UNKNOWN_STAGE failed',
    'E1-LIVE-08-STAGE LEGACY_CLEANUP failed',
    'E1-LIVE-09-STAGE LEGACY_CLEANUP passed',
    'E1-LIVE-09-STAGE legacy_cleanup failed',
    'E1-LIVE-09-STAGE LEGACY_CLEANUP failed private',
    'E1-LIVE-09-STAGE LEGACY_CLEANUP failed\nprivate',
  ]) {
    assert.equal(isSafeReportLine(unsafe), false);
  }
});

test('cookie failure reporting emits a fixed stage, never raw step or error fields' /**
 * Exercises the reporter boundary without a live browser or private fixture data.
 * @param {import('node:test').TestContext} context Scoped output mock ownership.
 * @returns {void}
 */, (context) => {
  const reporter = new SafeReporter();
  const step = {
    category: 'test.step',
    error: { message: 'synthetic-private-error', stack: 'synthetic-private-stack' },
    title: 'LEGACY_CLEANUP',
  };
  const output = context.mock.method(
    process.stdout,
    'write',
    /**
     * Prevents test-owned reporter records from reaching the real terminal.
     * @returns {boolean} Writable acceptance without forwarding any bytes.
     */
    () => true,
  );

  try {
    reporter.onStepEnd({ title: 'E1-LIVE-09' }, {}, step);

    for (const rejected of [
      { ...step, title: 'synthetic-private-step' },
      { ...step, title: 'LEGACY_CLEANUP\nsynthetic-private-step' },
      { ...step, category: 'pw:api' },
      { ...step, error: undefined },
    ]) {
      reporter.onStepEnd({ title: 'E1-LIVE-09' }, {}, rejected);
    }

    reporter.onStepEnd({ title: 'E1-LIVE-08-WRITE' }, {}, step);
    reporter.onStepEnd({ title: 'E1-LIVE-09 synthetic-private-title' }, {}, step);
  } finally {
    output.mock.restore();
  }

  assert.equal(output.mock.callCount(), 1);
  assert.deepEqual(output.mock.calls[0].arguments, ['E1-LIVE-09-STAGE LEGACY_CLEANUP failed\n']);
});

test('runner removes inherited recording, remote-browser, reuse and debug overrides' /**
 * Ensures common shell overrides cannot undo the private-run policy.
 * @returns {void}
 */, () => {
  const environment = liveRunnerEnvironment(
    {
      DEBUG: 'pw:api',
      NODE_OPTIONS: '--require unsafe',
      PATH: '/safe/runtime',
      PLAYWRIGHT_JSON_OUTPUT_FILE: '/unsafe/report',
      PW_TEST_CONNECT_WS_ENDPOINT: 'ws://remote',
      PW_TEST_REPORTER: 'html',
      PW_TEST_REUSE_CONTEXT: '1',
    },
    '/private/run',
  );
  assert.deepEqual(environment, {
    ASPECTLOOP_E1_RUN_DIR: '/private/run',
    PATH: '/safe/runtime',
    PLAYWRIGHT_NO_COPY_PROMPT: '1',
  });
});

test('complete response hold cannot deliver before explicit release and releases once' /**
 * Exercises cookie-neutral barriers without a backend or browser jar.
 * @returns {Promise<void>}
 */, async () => {
  const held = new HeldResponse('SignIn');
  let deliveries = 0;
  held.hold(
    /**
     * Models delivery completion, not a fake session response.
     * @returns {void}
     */
    () => {
      deliveries += 1;

      held.delivered();
    },
  );

  await held.received();

  assert.equal(deliveries, 0);
  held.release();
  held.release();

  await held.closed();

  assert.equal(deliveries, 1);
});

test('closed receiver settles before later upstream receipt and cannot hold teardown open' /**
 * Models document termination without inferring remote rollback.
 * @returns {Promise<void>}
 */, async () => {
  const held = new HeldResponse('SignOut');
  let retired = false;
  held.close();

  await held.closed();

  held.hold(
    /**
     * Drops transient buffered bytes for the cancelled receiver.
     * @returns {void}
     */
    () => {
      retired = true;
    },
  );

  await held.received();

  assert.equal(retired, true);
});

test('gate rejects foreign origins and arbitrary paths before opening an upstream request' /**
 * Uses only an owned ephemeral loopback listener, not a live stack.
 * @returns {Promise<void>}
 */, async () => {
  const gate = new ResponseGate();
  const port = await gate.start(0);

  try {
    const foreign = await fetch(`http://127.0.0.1:${port}/graphql`, {
      headers: { origin: 'https://foreign.invalid' },
      method: 'POST',
    });
    const arbitrary = await fetch(`http://127.0.0.1:${port}/forward`, {
      headers: { origin: LIVE_TOPOLOGY.web.origin },
      method: 'POST',
    });
    const mixed = await fetch(`http://127.0.0.1:${port}/graphql`, {
      body: JSON.stringify({
        operationName: 'Me',
        query: 'query Me { me { id } correctionSessions { id } }',
      }),
      headers: { origin: LIVE_TOPOLOGY.web.origin },
      method: 'POST',
    });
    assert.equal(foreign.status, 403);
    assert.equal(arbitrary.status, 403);
    assert.equal(mixed.status, 403);
    assert.equal(gate.observations.length, 0);
  } finally {
    await gate.stop();
  }
});

test('installed Playwright keeps snapshot suppression and message-only artifact preconditions' /**
 * Fails closed on an upgrade that invalidates the inspected privacy boundary.
 * @returns {Promise<void>}
 */, async () => {
  const recorder = await readFile(
    new URL('../../node_modules/playwright/lib/index.js', import.meta.url),
    'utf8',
  );
  const errors = await readFile(
    new URL('../../node_modules/playwright/lib/errorContext.js', import.meta.url),
    'utf8',
  );
  assert.equal(
    recorder.includes('if (process.env.PLAYWRIGHT_NO_COPY_PROMPT)\n      return;'),
    true,
  );
  assert.equal(errors.includes('if (!meaningfulErrors.length && !pageSnapshot)'), true);
});
