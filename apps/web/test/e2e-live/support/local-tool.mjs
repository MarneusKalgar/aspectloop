import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Closed command vocabulary shared by the private Node runner and TypeScript fixtures. */
export const LIVE_TOOL_ACTION = Object.freeze({
  CHECK: 'check',
  CLEANUP: 'cleanup',
  CREATE: 'create',
  REGISTRATION_CLEANUP: 'registration-cleanup',
  REGISTRATION_RESERVE: 'registration-reserve',
  REGISTRATION_TOKEN: 'registration-token',
  RESTORE_PLATFORM: 'restore-platform',
  STOP_PLATFORM: 'stop-platform',
});

const ACTION_REQUIRES_ID = Object.freeze({
  [LIVE_TOOL_ACTION.CHECK]: false,
  [LIVE_TOOL_ACTION.CLEANUP]: true,
  [LIVE_TOOL_ACTION.CREATE]: true,
  [LIVE_TOOL_ACTION.REGISTRATION_CLEANUP]: true,
  [LIVE_TOOL_ACTION.REGISTRATION_RESERVE]: true,
  [LIVE_TOOL_ACTION.REGISTRATION_TOKEN]: true,
  [LIVE_TOOL_ACTION.RESTORE_PLATFORM]: false,
  [LIVE_TOOL_ACTION.STOP_PLATFORM]: false,
});

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const tool = fileURLToPath(
  new URL('../../../../../infra/local/scripts/local-e1-tool.sh', import.meta.url),
);

const cookieStages = new Set([
  'BOOTSTRAP',
  'LEGACY_CLEANUP',
  'LOGOUT_COOKIES',
  'ORDINARY_READ',
  'REJECTED_LOGIN',
  'REJECTED_LOGIN_COOKIES',
  'SIGN_IN',
  'SIGN_IN_HEADERS',
  'SIGN_OUT',
  'SIGN_OUT_HEADERS',
]);
const confirmationStages = new Set([
  'LINK_CAPTURE',
  'MAIL_CAPTURE',
  'OUTAGE_CONFIRMATION',
  'RESTORE_CONFIRMATION',
  'REUSED_LINK',
  'SIGN_IN',
  'SIGN_OUT',
  'SIGN_UP',
]);
const lockStages = new Set([
  'ACQUISITION_TIMEOUT',
  'BOOTSTRAP',
  'HOLD_LOCK',
  'NO_DISPATCH',
  'RELEASE_LOCK',
  'WAITING_LOGIN',
]);

/**
 * Allows only fixed safe reporter records through the runner's output boundary.
 * @param {string} line A potentially unsafe child output line.
 * @returns {boolean} Whether the line contains only scenario status or an allowlisted failure stage.
 */
export function isSafeReportLine(line) {
  const stage = /^E1-LIVE-09-STAGE ([A-Z_]+) failed$/.exec(line)?.[1];
  const confirmationStage = /^E2-LIVE-01-STAGE ([A-Z_]+) failed$/.exec(line)?.[1];
  const lockStage = /^E1-LIVE-08-LOCK-STAGE ([A-Z_]+) failed$/.exec(line)?.[1];

  return (
    /^E1-LIVE-\d{2}(?:-[A-Z]+)? (?:passed|failed|timedOut|interrupted|skipped)$/.test(line) ||
    /^E1-LIVE-SUMMARY (?:passed|failed|timedout|interrupted)$/.test(line) ||
    /^E1-LIVE-COUNTS passed=\d{1,2} required=20 pending=\d{1,2}$/.test(line) ||
    /^E2-LIVE-01 (?:passed|failed|timedOut|interrupted|skipped)$/.test(line) ||
    /^E2-LIVE-COUNTS passed=[01] required=1 pending=[01]$/.test(line) ||
    (stage !== undefined && cookieStages.has(stage)) ||
    (confirmationStage !== undefined && confirmationStages.has(confirmationStage)) ||
    (lockStage !== undefined && lockStages.has(lockStage))
  );
}

/**
 * Removes inherited capture/remote/reuse overrides before launching the private live runner.
 * @param {NodeJS.ProcessEnv} environment The invoking shell environment.
 * @param {string} runDir A parent-owned directory containing safe UUID metadata only.
 * @returns {NodeJS.ProcessEnv} A bounded tool environment with the required privacy switch.
 */
export function liveRunnerEnvironment(environment, runDir) {
  const clean = Object.fromEntries(
    Object.entries(environment).filter(
      /**
       * Keeps unrelated runtime/Docker settings while removing unsafe browser overrides.
       * @param {[string, string | undefined]} entry An environment entry.
       * @returns {boolean}
       */
      ([key]) => !/^(?:PW_|PLAYWRIGHT_|DEBUG$|NODE_OPTIONS$)/.test(key),
    ),
  );

  return { ...clean, ASPECTLOOP_E1_RUN_DIR: runDir, PLAYWRIGHT_NO_COPY_PROMPT: '1' };
}

/**
 * Executes fixed tooling with bounded private pipes and credential-free failures.
 * @param {string} action A fixed live action validated before spawning.
 * @param {{ id?: string, input?: string, allowOutage?: boolean }} options Private input and exact ownership.
 * @returns {Promise<string>} Captured output for private metadata parsing, never raw reporting.
 */
export async function runTool(action, options = {}) {
  const args = toolArguments(action, options.id);

  if (
    options.input !== undefined &&
    (action !== LIVE_TOOL_ACTION.CREATE || Buffer.byteLength(options.input) > 256)
  ) {
    throw new Error('E1 private input rejected');
  }

  return new Promise(
    /**
     * Owns one bounded child and its private pipe lifecycle.
     * @param {(value: string) => void} resolve Private output resolver.
     * @param {(error: Error) => void} reject Safe failure resolver.
     * @returns {void}
     */
    (resolve, reject) => {
      const child = spawn('bash', args, {
        env: {
          ...process.env,
          ASPECTLOOP_E1_ALLOW_OUTAGE: options.allowOutage ? '1' : '0',
          ASPECTLOOP_E2_PRIVATE_PIPE: action === LIVE_TOOL_ACTION.REGISTRATION_TOKEN ? '1' : '0',
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      let output = '';
      let outputSize = 0;
      let failed = false;
      const timer = setTimeout(expire, 60_000);

      /**
       * Kills only the owned process after the fixed deadline.
       * @returns {void}
       */
      function expire() {
        failed = true;
        child.kill('SIGKILL');
      }

      child.stdout.on(
        'data',
        /**
         * Retains only bounded private tool output.
         * @param {Buffer} chunk Private bytes, never reported directly.
         * @returns {void}
         */
        (chunk) => {
          outputSize += chunk.length;

          if (outputSize > 32_768) {
            expire();
            return;
          }

          output += chunk.toString('utf8');
        },
      );

      // Drain without retaining failures, which may contain DSNs or SQL parameters.
      child.stderr.resume();

      child.stdin.on(
        'error',
        /**
         * Records an early pipe close without exposing its input.
         * @returns {void}
         */
        () => {
          failed = true;
        },
      );

      child.once(
        'error',
        /**
         * Omits spawn and environment details.
         * @returns {void}
         */
        () => {
          clearTimeout(timer);
          reject(new Error(`E1 tool ${action} failed`));
        },
      );

      child.once(
        'close',
        /**
         * Settles the private job without forwarding raw failures.
         * @param {number | null} code Child exit status.
         * @returns {void}
         */
        (code) => {
          clearTimeout(timer);

          if (failed || code !== 0) {
            reject(new Error(`E1 tool ${action} failed`));
            return;
          }

          resolve(output);
        },
      );

      child.stdin.end(options.input ?? '');
    },
  );
}

/**
 * Validates the closed local tool surface before spawning anything.
 * @param {string} action An untrusted command name checked against the closed vocabulary.
 * @param {string | undefined} id The exact fixture ID for fixture commands only.
 * @returns {string[]} Validated shell arguments.
 */
export function toolArguments(action, id) {
  if (typeof action !== 'string' || !Object.hasOwn(ACTION_REQUIRES_ID, action)) {
    throw new Error('E1 tool arguments rejected');
  }

  if (ACTION_REQUIRES_ID[action]) {
    if (typeof id !== 'string' || !UUID_PATTERN.test(id)) {
      throw new Error('E1 tool arguments rejected');
    }

    return [tool, action, id];
  }

  if (id !== undefined) {
    throw new Error('E1 tool arguments rejected');
  }

  return [tool, action];
}
