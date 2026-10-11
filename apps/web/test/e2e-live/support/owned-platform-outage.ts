import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { waitForGateway } from './live-prerequisites.ts';
import { LIVE_TOOL_ACTION, runTool } from './local-tool.mjs';

/** Owns the worker's exact outage; the persisted intent also permits parent crash cleanup. */
export function createOwnedPlatformOutage(runDir: string): {
  restorePlatform: () => Promise<void>;
  stopPlatform: () => Promise<void>;
} {
  let platformStopped = false;

  /** Restores only the initially healthy service this worker explicitly stopped. */
  async function restorePlatform(): Promise<void> {
    if (!platformStopped) {
      return;
    }

    await runTool(LIVE_TOOL_ACTION.RESTORE_PLATFORM, { allowOutage: true });
    await waitForGateway(true);
    await unlink(join(runDir, 'platform-stop-intent'));
    platformStopped = false;
  }

  /** Persists ownership before the separately authorized exact service stop. */
  async function stopPlatform(): Promise<void> {
    await writeFile(join(runDir, 'platform-stop-intent'), 'owned', { mode: 0o600 });
    platformStopped = true;

    await runTool(LIVE_TOOL_ACTION.STOP_PLATFORM, { allowOutage: true });
    await waitForGateway(false);
  }

  return { restorePlatform, stopPlatform };
}
