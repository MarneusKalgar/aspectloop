import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  isSafeReportLine,
  liveRunnerEnvironment,
  runTool,
} from '../../apps/web/test/e2e-live/support/local-tool.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Runs only the complete opt-in matrix and owns final cleanup, even after worker failure.
 * @returns {Promise<void>} Completion with a nonzero exit status for any pending evidence/cleanup.
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length !== 1 || args[0] !== '--allow-platform-outage' || process.env.CI) {
    console.error(
      'E1 live requires an exclusive local window: npm run test:e2e:live -- --allow-platform-outage',
    );
    console.error(
      'It temporarily stops/restores only Platform; stop the Web dev server on localhost:5173 first. No CI, downloads, migrations or resets.',
    );
    process.exitCode = 2;
    return;
  }

  await runTool('check');

  const runDir = await mkdtemp(join(tmpdir(), 'aspectloop-e1-'));
  const ids = [randomUUID(), randomUUID()];
  let child;
  let interrupted = false;
  let cleanupFailed = false;
  let forceStopTimer;

  /**
   * Interrupts only the owned runner; cleanup is awaited before exit.
   * @returns {void}
   */
  function interrupt() {
    interrupted = true;
    child?.kill('SIGTERM');

    if (child && !forceStopTimer) {
      forceStopTimer = setTimeout(
        /**
         * Bounds hung graceful teardown; exact parent cleanup still runs.
         * @returns {void}
         */
        () => child.kill('SIGKILL'),
        30_000,
      );
    }
  }

  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);

  try {
    await writeFile(join(runDir, 'scope.json'), JSON.stringify({ ids }), { mode: 0o600 });

    for (const id of ids) {
      console.log(
        `E1 owned fixture ID: ${id} (exact recovery: npm run local:auth:verify -- --fixture-cleanup ${id})`,
      );
    }

    if (interrupted) {
      throw new Error('E1 interrupted');
    }

    child = spawn(
      process.execPath,
      [
        join(root, 'node_modules/playwright/cli.js'),
        'test',
        '--config',
        'apps/web/playwright.live.config.ts',
      ],
      {
        cwd: root,
        env: liveRunnerEnvironment(process.env, runDir),
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );

    let pending = '';
    child.stdout.on(
      'data',
      /**
       * Omits all non-allowlisted diagnostics.
       * @param {Buffer} chunk Reporter output.
       * @returns {void}
       */
      (chunk) => {
        pending += chunk.toString('utf8');
        const lines = pending.split('\n');
        pending = lines.pop() ?? '';

        for (const line of lines) {
          if (isSafeReportLine(line)) {
            console.log(line);
          }
        }

        if (pending.length > 4096) {
          pending = '';
        }
      },
    );

    child.stderr.resume();
    const deadline = setTimeout(
      /**
       * Bounds the entire owned run without skipping scenarios.
       * @returns {void}
       */
      interrupt,
      12 * 60_000,
    );

    try {
      const code = await new Promise(
        /**
         * Joins the owned process independently from secret-free reporting.
         * @param {(value: number | null) => void} resolve Exit status resolver.
         * @param {(error: Error) => void} reject Safe spawn failure resolver.
         * @returns {void}
         */
        (resolve, reject) => {
          child.once(
            'error',
            /**
             * Omits process paths/environment diagnostics.
             * @returns {void}
             */
            () => reject(new Error('E1 runner failed to start')),
          );

          child.once(
            'close',
            /**
             * Returns only an exit status.
             * @param {number | null} value Runner exit status.
             * @returns {void}
             */
            (value) => resolve(value),
          );
        },
      );

      if (code !== 0 || interrupted) {
        process.exitCode = 1;
        console.error(
          'E1 live incomplete/failed; raw diagnostics intentionally omitted. Check prerequisites and safe scenario IDs.',
        );
      }
    } finally {
      clearTimeout(deadline);
      clearTimeout(forceStopTimer);
    }
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', interrupt);

    try {
      await readFile(join(runDir, 'platform-stop-intent'));
      await runTool('restore-platform', { allowOutage: true });
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) {
        cleanupFailed = true;
        console.error(
          'E1 Platform restoration failed; run npm run local:start and confirm readiness.',
        );
      }
    }

    for (const id of ids) {
      try {
        await runTool('cleanup', { id });
      } catch {
        cleanupFailed = true;
        console.error(`E1 exact fixture cleanup failed: ${id}`);
      }
    }

    if (cleanupFailed) {
      process.exitCode = 1;
      console.error(`E1 safe ownership ledger retained: ${runDir}`);
    } else {
      await rm(runDir, { recursive: true });
      console.log('E1 exact fixture cleanup and owned-artifact removal completed.');
    }
  }
}

void main().catch(
  /**
   * Never prints raw backend/browser/tool exceptions.
   * @returns {void}
   */
  () => {
    console.error('E1 live preflight/orchestration failed; details omitted.');
    process.exitCode = 1;
  },
);
