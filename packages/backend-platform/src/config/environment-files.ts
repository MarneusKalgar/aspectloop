import { config as loadDotEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Returns the ordered local environment-file candidates for a backend application.
 *
 * @param cwd Application working directory.
 * @returns Local override and fallback environment-file paths.
 */
export function getEnvFilePaths(cwd: string = process.cwd()): string[] {
  return [resolve(cwd, '.env.local'), resolve(cwd, '.env')];
}

/**
 * Loads available backend environment files without overriding injected values.
 *
 * @param cwd Application working directory.
 */
export function loadEnvFiles(cwd: string = process.cwd()): void {
  for (const filePath of getEnvFilePaths(cwd)) {
    if (existsSync(filePath)) {
      loadDotEnv({ override: false, path: filePath });
    }
  }
}
