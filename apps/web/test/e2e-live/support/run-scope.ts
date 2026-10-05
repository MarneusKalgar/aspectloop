import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

import { UUID_PATTERN } from './local-tool.mjs';

/** Validates ephemeral tool-only configuration; it is not a persisted application env setting. */
export function readRunScope(): { ids: [string, string]; runDir: string } {
  const runDir = process.env.ASPECTLOOP_E1_RUN_DIR;

  if (
    !runDir ||
    process.env.CI ||
    process.env.PLAYWRIGHT_NO_COPY_PROMPT !== '1' ||
    dirname(resolve(runDir)) !== resolve(tmpdir()) ||
    !/[/\\]aspectloop-e1-[\w-]+$/.test(runDir)
  ) {
    throw new Error('Use the approved E1 live runner');
  }

  const raw = readFileSync(join(runDir, 'scope.json'), 'utf8');

  if (raw.length > 256) {
    throw new Error('E1 ownership scope rejected');
  }

  const scope = JSON.parse(raw) as { ids?: unknown };

  if (
    !Array.isArray(scope.ids) ||
    scope.ids.length !== 2 ||
    !scope.ids.every(
      /** Allows exact fixture identifiers only; no credential or URL configuration. */
      (id: unknown) => typeof id === 'string' && UUID_PATTERN.test(id),
    ) ||
    scope.ids[0] === scope.ids[1]
  ) {
    throw new Error('E1 ownership scope rejected');
  }

  return { ids: scope.ids as [string, string], runDir };
}
