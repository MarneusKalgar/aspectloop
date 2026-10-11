export const LIVE_TOOL_ACTION: Readonly<{
  CHECK: 'check';
  CLEANUP: 'cleanup';
  CREATE: 'create';
  REGISTRATION_CLEANUP: 'registration-cleanup';
  REGISTRATION_RESERVE: 'registration-reserve';
  REGISTRATION_TOKEN: 'registration-token';
  RESTORE_PLATFORM: 'restore-platform';
  STOP_PLATFORM: 'stop-platform';
}>;

export type LiveToolAction = (typeof LIVE_TOOL_ACTION)[keyof typeof LIVE_TOOL_ACTION];

export const UUID_PATTERN: RegExp;

/** Validates the colocated fixed tool command and optional exact cleanup ID. */
export function toolArguments(action: string, id?: string): string[];

/** Captures private tool output without exposing credential-bearing failures. */
export function runTool(
  action: LiveToolAction,
  options?: { id?: string; input?: string; allowOutage?: boolean },
): Promise<string>;

/** Accepts only safe scenario-status output. */
export function isSafeReportLine(line: string): boolean;

/** Removes inherited capture/remote/reuse configuration from the owned browser run. */
export function liveRunnerEnvironment(
  environment: NodeJS.ProcessEnv,
  runDir: string,
): NodeJS.ProcessEnv;
