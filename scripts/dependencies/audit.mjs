#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluateAuditReport } from './audit-policy.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Runs npm's full audit and applies the reviewed temporary exception.
 *
 * @returns {void} Reports the audit decision and sets the process exit code.
 */
function main() {
  const result = spawnSync('npm', ['audit', '--json', '--audit-level=high'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });

  if (result.error || ![0, 1].includes(result.status)) {
    console.error('Dependency audit could not complete:', result.error?.message ?? result.stderr);
    process.exitCode = 1;
    return;
  }

  let report;
  let lockfile;

  try {
    report = JSON.parse(result.stdout);
    lockfile = JSON.parse(readFileSync(join(repositoryRoot, 'package-lock.json'), 'utf8'));
  } catch (error) {
    console.error('Dependency audit could not parse its report or lockfile:', error);
    process.exitCode = 1;
    return;
  }

  if (report.error) {
    console.error('npm audit reported an error:', report.error);
    process.exitCode = 1;
    return;
  }

  const decision = evaluateAuditReport(report, lockfile);

  if (!decision.allowed) {
    console.error('Dependency audit blocked:');
    for (const error of decision.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('Dependency audit passed with one temporary high-severity exception:');
  console.log('- dev-only braces@3.0.3, GHSA-vfj7-8cjw-p6xm, expires 2026-10-17 UTC');
  console.log('All other high/critical findings remain blocking.');
}

main();
