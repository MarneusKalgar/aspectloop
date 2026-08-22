import { spawnSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

import { CHANGE_GROUPS } from './change-groups.mjs';

/**
 * @typedef {{
 *   after?: string,
 *   before?: string,
 *   pull_request?: {
 *     base?: { sha?: string },
 *     head?: { sha?: string },
 *   },
 * }} GitHubEventPayload
 */

/**
 * Reports whether the selected revisions differ under the configured paths.
 *
 * @param {string} base Base revision SHA.
 * @param {string} head Head revision SHA.
 * @param {readonly string[]} paths Git pathspecs owned by the change group.
 * @returns {boolean}
 */
function detectChanges(base, head, paths) {
  const result = spawnSync('git', ['diff', '--quiet', base, head, '--', ...paths], {
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status === 0) {
    return false;
  }

  if (result.status === 1) {
    return true;
  }

  throw new Error(`git diff failed with exit code ${result.status ?? 'unknown'}.`);
}

/**
 * Returns the configured path group or fails for an unsupported group name.
 *
 * @param {string | undefined} name Requested change-group name.
 * @returns {{ changedReason: string, paths: readonly string[], unchangedReason: string }}
 */
function getChangeGroup(name) {
  const group = name ? CHANGE_GROUPS[name] : undefined;

  if (!group) {
    const available = Object.keys(CHANGE_GROUPS).join(', ');
    throw new Error(`Unknown change group "${name ?? ''}". Expected one of: ${available}.`);
  }

  return group;
}

/**
 * Executes fixed-group change detection for the current GitHub event.
 *
 * @returns {void}
 */
function main() {
  const group = getChangeGroup(process.argv[2]);
  const eventName = process.env.GITHUB_EVENT_NAME;
  const payload = readEventPayload(process.env.GITHUB_EVENT_PATH);

  if (eventName === 'workflow_dispatch') {
    const forced = process.env.FORCE_CHANGED;
    const output =
      forced === undefined
        ? { changed: 'not-evaluated', reason: 'manual dispatch has no comparison' }
        : { changed: forced === 'true', reason: 'manual input' };
    writeOutputs(process.env.GITHUB_OUTPUT, output);
    return;
  }

  const range = resolveRevisionRange(eventName, payload, process.env.GITHUB_SHA);

  if (!range) {
    writeOutputs(process.env.GITHUB_OUTPUT, {
      changed: true,
      reason: 'no comparable base revision',
    });
    return;
  }

  const changed = detectChanges(range.base, range.head, group.paths);
  writeOutputs(process.env.GITHUB_OUTPUT, {
    changed,
    reason: changed ? group.changedReason : group.unchangedReason,
  });
}

/**
 * Reads the GitHub-supplied event metadata file for the workflow run.
 *
 * @param {string | undefined} eventPath GitHub event payload path.
 * @returns {GitHubEventPayload}
 */
function readEventPayload(eventPath) {
  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH is required.');
  }

  return JSON.parse(readFileSync(eventPath, 'utf8'));
}

/**
 * Resolves the revisions that bound a pull-request or push comparison.
 *
 * @param {string | undefined} eventName GitHub event name.
 * @param {GitHubEventPayload} payload Parsed GitHub event payload.
 * @param {string | undefined} fallbackHead Current workflow revision.
 * @returns {{ base: string, head: string } | null}
 */
function resolveRevisionRange(eventName, payload, fallbackHead) {
  if (eventName === 'pull_request') {
    const base = payload.pull_request?.base?.sha;
    const head = payload.pull_request?.head?.sha;
    return base && head ? { base, head } : null;
  }

  if (eventName === 'push') {
    const base = payload.before;
    const head = payload.after ?? fallbackHead;
    const hasComparableBase = typeof base === 'string' && !/^0+$/.test(base);
    return hasComparableBase && head ? { base, head } : null;
  }

  return null;
}

/**
 * Appends stable values to the current GitHub Actions step output file.
 *
 * @param {string | undefined} outputPath GitHub step output path.
 * @param {{ changed: boolean | 'not-evaluated', reason: string }} output Output values.
 * @returns {void}
 */
function writeOutputs(outputPath, output) {
  if (!outputPath) {
    throw new Error('GITHUB_OUTPUT is required.');
  }

  appendFileSync(
    outputPath,
    `changed=${String(output.changed)}\nreason=${output.reason}\n`,
    'utf8',
  );
}

main();
