export const UUID_PATTERN: RegExp;

/** Validates the colocated fixed tool command and optional exact cleanup ID. */
export function toolArguments(action: string, id?: string): string[];

/** Captures private tool output without exposing credential-bearing failures. */
export function runTool(action: string, options?: { id?: string; input?: string; allowOutage?: boolean }): Promise<string>;

/** Accepts only safe scenario-status output. */
export function isSafeReportLine(line: string): boolean;

/** Removes inherited capture/remote/reuse configuration from the owned browser run. */
export function liveRunnerEnvironment(environment: NodeJS.ProcessEnv, runDir: string): NodeJS.ProcessEnv;
