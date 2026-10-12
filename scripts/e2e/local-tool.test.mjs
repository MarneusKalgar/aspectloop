import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { selectedOperation } from '../../apps/web/test/e2e-live/support/gate-operations.ts';
import { HeldResponse } from '../../apps/web/test/e2e-live/support/held-response.ts';
import { LIVE_TOPOLOGY } from '../../apps/web/test/e2e-live/support/live-topology.ts';
import {
  isSafeReportLine,
  LIVE_TOOL_ACTION,
  liveRunnerEnvironment,
  toolArguments,
} from '../../apps/web/test/e2e-live/support/local-tool.mjs';
import { originalSessionState } from '../../apps/web/test/e2e-live/support/original-session-probe.ts';
import { parseRegistrationLink } from '../../apps/web/test/e2e-live/support/private-fixtures.ts';
import { ResponseGate } from '../../apps/web/test/e2e-live/support/response-gate.ts';
import {
  parseRunOwnership,
  validateRunDirectory,
} from '../../apps/web/test/e2e-live/support/run-scope.ts';
import SafeReporter from '../../apps/web/test/e2e-live/support/safe-reporter.ts';

const id = 'd41be59c-d8eb-4e8c-a5e1-99aab7197f04';

test('live action constants preserve the closed shell vocabulary' /**
 * Locks the public action spelling independently of the implementation's lookup table.
 * @returns {void}
 */, () => {
  assert.equal(Object.isFrozen(LIVE_TOOL_ACTION), true);
  assert.deepEqual(Object.values(LIVE_TOOL_ACTION).sort(), [
    'check',
    'cleanup',
    'create',
    'registration-cleanup',
    'registration-reserve',
    'registration-token',
    'restore-platform',
    'stop-platform',
  ]);

  for (const action of [
    LIVE_TOOL_ACTION.CHECK,
    LIVE_TOOL_ACTION.RESTORE_PLATFORM,
    LIVE_TOOL_ACTION.STOP_PLATFORM,
  ]) {
    assert.equal(toolArguments(action).at(-1), action);
  }

  for (const action of ['__proto__', 'constructor', 'toString', null, {}, ['check']]) {
    assert.throws(
      /**
       * Rejects inherited object keys before any process can be spawned.
       * @returns {string[]} Arguments only if the boundary is broken.
       */
      () => toolArguments(action),
      /E1 tool arguments rejected/,
    );
  }
});

test('ownership parser admits only distinct fixture IDs and safe projections' /**
 * Exercises E1/E2 scope validation without filesystem access or backend operations.
 * @returns {void}
 */, () => {
  const second = 'dd476851-713d-4a87-a33f-326e0f351c37';
  const registrationId = '6b6f1dc0-c7dd-4ba2-98c5-bbb9eb609c53';
  const ids = [id, second];
  assert.deepEqual(parseRunOwnership(JSON.stringify({ ids })), { ids });
  assert.deepEqual(parseRunOwnership(JSON.stringify({ ids, registrationId })), {
    ids,
    registrationId,
  });
  assert.deepEqual(parseRunOwnership(JSON.stringify({ ids, ignored: true })), { ids });

  for (const raw of [
    'null',
    '[]',
    'false',
    '"private"',
    '{',
    ' '.repeat(257),
    '{}',
    JSON.stringify({ ids: [id] }),
    JSON.stringify({ ids: [id, id] }),
    JSON.stringify({ ids: [id, '../'] }),
    JSON.stringify({ ids, registrationId: id }),
    JSON.stringify({ ids, registrationId: null }),
    JSON.stringify({ ids, registrationId: '../' }),
  ]) {
    assert.throws(
      /**
       * Rejects malformed ownership without retaining raw parsing diagnostics.
       * @returns {object} Ownership only if validation is broken.
       */
      () => parseRunOwnership(raw),
      /E1 ownership scope rejected/,
    );
  }
});

test('runner directory admission preserves local-only and privacy restrictions' /**
 * Uses synthetic directories; it neither reads ledgers nor changes the process environment.
 * @returns {void}
 */, () => {
  const directory = '/owned/tmp/aspectloop-e1-fixture';
  const environment = {
    ASPECTLOOP_E1_RUN_DIR: directory,
    PLAYWRIGHT_NO_COPY_PROMPT: '1',
  };
  assert.equal(validateRunDirectory(environment, '/owned/tmp'), directory);

  for (const rejected of [
    { ...environment, CI: '1' },
    { ...environment, PLAYWRIGHT_NO_COPY_PROMPT: '0' },
    { ...environment, ASPECTLOOP_E1_RUN_DIR: undefined },
    { ...environment, ASPECTLOOP_E1_RUN_DIR: '/foreign/aspectloop-e1-fixture' },
    { ...environment, ASPECTLOOP_E1_RUN_DIR: '/owned/tmp/nested/aspectloop-e1-fixture' },
    { ...environment, ASPECTLOOP_E1_RUN_DIR: '/owned/tmp/not-a-run' },
  ]) {
    assert.throws(
      /**
       * Rejects foreign execution contexts without accessing their filesystem.
       * @returns {string} An admitted directory only if the guard is broken.
       */
      () => validateRunDirectory(rejected, '/owned/tmp'),
      /Use the approved E1 live runner/,
    );
  }
});

test('private registration envelope parsing stays bounded and rejects malformed roots' /**
 * Uses synthetic link bytes only; real private capture never reaches these tests or reports.
 * @returns {void}
 */, () => {
  const token = `${id}.${'a'.repeat(43)}`;
  assert.deepEqual(
    parseRegistrationLink(`tool noise\nE2_LINK ${JSON.stringify({ id, token })}\n`),
    {
      id,
      token,
    },
  );

  for (const output of [
    '',
    'E2_LINK null',
    'E2_LINK []',
    'E2_LINK {',
    `E2_LINK ${'x'.repeat(257)}`,
    `E2_LINK ${JSON.stringify({ id: '../', token })}`,
    `E2_LINK ${JSON.stringify({ id, token: 'a'.repeat(129) })}`,
    `E2_LINK ${JSON.stringify({ id, token: 'unsafe?alphabet' })}`,
    `E2_LINK ${JSON.stringify({ id, token: '' })}`,
    `E2_LINK ${JSON.stringify({ extra: true, id, token })}`,
  ]) {
    assert.throws(
      /**
       * Rejects private malformed envelopes with fixed credential-free failures.
       * @returns {object} A parsed synthetic link only if validation is broken.
       */
      () => parseRegistrationLink(output),
      /metadata rejected/,
    );
  }
});

test('live operation catalog preserves default admission, opt-in and exact kind/root checks' /**
 * Tests the gate against independent literal cases, not a copy derived from its catalog.
 * @returns {void}
 */, () => {
  for (const [name, kind, root, registrationRequired] of [
    ['CorrectionSessions', 'query', 'correctionSessions', false],
    ['Me', 'query', 'me', false],
    ['SignIn', 'mutation', 'signIn', false],
    ['SignOut', 'mutation', 'signOut', false],
    ['SignUp', 'mutation', 'signUp', true],
    ['ConfirmEmail', 'mutation', 'confirmEmail', true],
    ['ResendEmailConfirmation', 'mutation', 'resendEmailConfirmation', true],
  ]) {
    const body = Buffer.from(
      JSON.stringify({ operationName: name, query: `${kind} ${name} { ${root} { __typename } }` }),
    );
    assert.equal(selectedOperation(body, true), name);

    if (registrationRequired) {
      assert.throws(
        /**
         * Confirms that the default gate still excludes each registration operation.
         * @returns {string} A selected label only if opt-in admission is broken.
         */
        () => selectedOperation(body),
        /operation rejected/,
      );
    } else {
      assert.equal(selectedOperation(body), name);
    }

    const wrongKind = kind === 'query' ? 'mutation' : 'query';

    for (const query of [
      `${wrongKind} ${name} { ${root} { __typename } }`,
      `${kind} ${name} { __typename }`,
      `${kind} ${name} { ${root} { __typename } __typename }`,
    ]) {
      assert.throws(
        /**
         * Rejects altered kind, root and mixed-root requests even when registration is enabled.
         * @returns {string} A selected label only if AST validation is broken.
         */
        () => selectedOperation(Buffer.from(JSON.stringify({ operationName: name, query })), true),
        /operation rejected/,
      );
    }
  }

  for (const operationName of [
    undefined,
    null,
    42,
    {},
    [],
    '__proto__',
    'constructor',
    'toString',
    'UnexpectedOperation',
    'me',
  ]) {
    assert.throws(
      /**
       * Rejects non-string, unknown and inherited-property names before catalog lookup.
       * @returns {string} A selected label only if closed vocabulary admission is broken.
       */
      () =>
        selectedOperation(
          Buffer.from(JSON.stringify({ operationName, query: 'query Me { me { id } }' })),
          true,
        ),
      /operation rejected/,
    );
  }
});

test('registration forwarding is opt-in and still checks a single fixed mutation root' /**
 * Preserves the E1 surface and rejects a label that hides product or mixed roots.
 * @returns {void}
 */, () => {
  const body = Buffer.from(
    JSON.stringify({
      operationName: 'ConfirmEmail',
      query:
        'mutation ConfirmEmail($input: ConfirmEmailInput!) { confirmEmail(input: $input) { success } }',
    }),
  );
  assert.throws(
    /**
     * Attempts the new operation on the unchanged E1 gate.
     * @returns {string} A selected label only if the guard is broken.
     */
    () => selectedOperation(body),
  );
  assert.equal(selectedOperation(body, true), 'ConfirmEmail');

  for (const query of [
    'mutation ConfirmEmail { signOut { success } }',
    'mutation ConfirmEmail { confirmEmail(input: {token: "fixture"}) { success } signOut { success } }',
  ]) {
    assert.throws(
      /**
       * Rejects forged or mixed roots without sending any network request.
       * @returns {string} A selected label only if the guard is broken.
       */
      () =>
        selectedOperation(
          Buffer.from(JSON.stringify({ operationName: 'ConfirmEmail', query })),
          true,
        ),
    );
  }
});

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
  assert.equal(toolArguments('registration-reserve', id).at(-1), id);
  assert.equal(toolArguments('registration-token', id).at(-1), id);
  assert.equal(toolArguments('registration-cleanup', id).at(-1), id);

  for (const [action, identifier] of [
    ['create', undefined],
    ['cleanup', 'all'],
    ['stop-platform; env', undefined],
    ['check', id],
    ['cleanup', '../'],
    ['registration-token', 'all'],
    ['registration-cleanup', '../'],
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
 * Checks every allowed cookie, confirmation and lock failure stage at the reporting boundary.
 * @returns {void}
 */, () => {
  assert.equal(isSafeReportLine('E1-LIVE-04-TIMEOUT passed'), true);
  assert.equal(isSafeReportLine('E1-LIVE-SUMMARY failed'), true);
  assert.equal(isSafeReportLine('E1-LIVE-COUNTS passed=20 required=20 pending=0'), true);
  assert.equal(isSafeReportLine('E1-LIVE-COUNTS passed=1 required=20 pending=19 private'), false);
  assert.equal(isSafeReportLine('E2-LIVE-01 passed'), true);
  assert.equal(isSafeReportLine('E2-LIVE-COUNTS passed=1 required=1 pending=0'), true);
  assert.equal(isSafeReportLine('E2_LINK {"token":"synthetic-private"}'), false);
  assert.equal(isSafeReportLine('E2-LIVE-01 synthetic-private'), false);

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
    'E2-LIVE-01-STAGE UNKNOWN_STAGE failed',
    'E2-LIVE-02-STAGE MAIL_CAPTURE failed',
    'E2-LIVE-01-STAGE MAIL_CAPTURE passed',
    'E2-LIVE-01-STAGE mail_capture failed',
    'E2-LIVE-01-STAGE MAIL_CAPTURE failed private',
    'E2-LIVE-01-STAGE MAIL_CAPTURE failed\nprivate',
    'E1-LIVE-08-LOCK-STAGE UNKNOWN_STAGE failed',
    'E1-LIVE-08-UNSUPPORTED-STAGE NO_DISPATCH failed',
    'E1-LIVE-08-LOCK-STAGE NO_DISPATCH passed',
    'E1-LIVE-08-LOCK-STAGE no_dispatch failed',
    'E1-LIVE-08-LOCK-STAGE NO_DISPATCH failed private',
    'E1-LIVE-08-LOCK-STAGE NO_DISPATCH failed\nprivate',
  ]) {
    assert.equal(isSafeReportLine(unsafe), false);
  }

  for (const stage of [
    'SIGN_UP',
    'MAIL_CAPTURE',
    'LINK_CAPTURE',
    'OUTAGE_CONFIRMATION',
    'RESTORE_CONFIRMATION',
    'SIGN_IN',
    'REUSED_LINK',
    'SIGN_OUT',
  ]) {
    assert.equal(isSafeReportLine(`E2-LIVE-01-STAGE ${stage} failed`), true);
  }

  for (const stage of [
    'BOOTSTRAP',
    'HOLD_LOCK',
    'WAITING_LOGIN',
    'ACQUISITION_TIMEOUT',
    'NO_DISPATCH',
    'RELEASE_LOCK',
  ]) {
    assert.equal(isSafeReportLine(`E1-LIVE-08-LOCK-STAGE ${stage} failed`), true);
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

test('confirmation failure reporting emits only an allowlisted failure stage' /**
 * Locks safe E2 reporting without disclosing raw step metadata, fixture data or errors.
 * @param {import('node:test').TestContext} context Scoped output mock ownership.
 * @returns {void}
 */, (context) => {
  const reporter = new SafeReporter();
  const step = {
    category: 'test.step',
    error: { message: 'synthetic-private-error', stack: 'synthetic-private-stack' },
    title: 'MAIL_CAPTURE',
  };
  const output = context.mock.method(
    process.stdout,
    'write',
    /**
     * Intercepts only the test-owned reporting boundary without forwarding private metadata.
     * @returns {boolean} Writable acceptance without forwarding any bytes.
     */
    () => true,
  );

  try {
    reporter.onStepEnd({ title: 'E2-LIVE-01' }, {}, step);

    for (const rejected of [
      { ...step, title: 'synthetic-private-step' },
      { ...step, title: 'MAIL_CAPTURE\nsynthetic-private-step' },
      { ...step, title: 'LEGACY_CLEANUP' },
      { ...step, category: 'pw:api' },
      { ...step, error: undefined },
    ]) {
      reporter.onStepEnd({ title: 'E2-LIVE-01' }, {}, rejected);
    }

    reporter.onStepEnd({ title: 'E2-LIVE-02' }, {}, step);
    reporter.onStepEnd({ title: 'E2-LIVE-01 synthetic-private-title' }, {}, step);
    reporter.onStepEnd({ title: 'E1-LIVE-09' }, {}, step);
  } finally {
    output.mock.restore();
  }

  assert.equal(output.mock.callCount(), 1);
  assert.deepEqual(output.mock.calls[0].arguments, ['E2-LIVE-01-STAGE MAIL_CAPTURE failed\n']);
});

test('lock failure reporting emits closed stages without raw error fields' /**
 * Locks safe native-lock diagnostics to one exact scenario and its fixed failure labels.
 * @param {import('node:test').TestContext} context Scoped output mock ownership.
 * @returns {void}
 */, (context) => {
  const reporter = new SafeReporter();
  const step = {
    category: 'test.step',
    error: { message: 'synthetic-private-error', stack: 'synthetic-private-stack' },
    title: 'NO_DISPATCH',
  };
  const stages = [
    'BOOTSTRAP',
    'HOLD_LOCK',
    'WAITING_LOGIN',
    'ACQUISITION_TIMEOUT',
    'NO_DISPATCH',
    'RELEASE_LOCK',
  ];
  const output = context.mock.method(
    process.stdout,
    'write',
    /**
     * Intercepts the test-owned output boundary without forwarding any raw metadata.
     * @returns {boolean} Writable acceptance without terminal output.
     */
    () => true,
  );

  try {
    for (const title of stages) {
      reporter.onStepEnd({ title: 'E1-LIVE-08-LOCK' }, {}, { ...step, title });
    }

    for (const rejected of [
      { ...step, title: 'synthetic-private-step' },
      { ...step, title: 'NO_DISPATCH\nsynthetic-private-step' },
      { ...step, title: 'MAIL_CAPTURE' },
      { ...step, category: 'pw:api' },
      { ...step, error: undefined },
    ]) {
      reporter.onStepEnd({ title: 'E1-LIVE-08-LOCK' }, {}, rejected);
    }

    reporter.onStepEnd({ title: 'E1-LIVE-08-UNSUPPORTED' }, {}, step);
    reporter.onStepEnd({ title: 'E1-LIVE-08-LOCK synthetic-private-title' }, {}, step);
    reporter.onStepEnd({ title: 'E1-LIVE-09' }, {}, step);
    reporter.onStepEnd({ title: 'E2-LIVE-01' }, {}, step);
  } finally {
    output.mock.restore();
  }

  assert.equal(output.mock.callCount(), stages.length);

  for (const [index, stage] of stages.entries()) {
    assert.deepEqual(output.mock.calls[index].arguments, [
      `E1-LIVE-08-LOCK-STAGE ${stage} failed\n`,
    ]);
  }
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
