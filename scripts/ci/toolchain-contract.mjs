#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Verifies that the active Node.js and npm executables satisfy the repository contract.
 *
 * @param {{ nodeVersion: string, npmVersion: string }} contract Toolchain contract.
 */
function assertToolchainContract(contract) {
  const activeNodeVersion = process.versions.node;
  const activeNpmVersion = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
  const mismatches = [];

  if (activeNodeVersion !== contract.nodeVersion) {
    mismatches.push(`Node.js ${activeNodeVersion}; expected ${contract.nodeVersion}`);
  }

  if (activeNpmVersion !== contract.npmVersion) {
    mismatches.push(`npm ${activeNpmVersion}; expected ${contract.npmVersion}`);
  }

  if (mismatches.length > 0) {
    throw new Error(`Toolchain contract mismatch: ${mismatches.join('; ')}`);
  }
}

/**
 * Executes the requested toolchain contract operation.
 */
function main() {
  const command = process.argv[2];
  const contract = readToolchainContract();

  if (command === 'export') {
    writeGithubOutputs(contract);
    return;
  }

  if (command === 'assert') {
    assertToolchainContract(contract);
    return;
  }

  throw new Error('Expected one command: export or assert');
}

/**
 * Reads and validates the repository's exact Node.js and npm selections.
 *
 * @returns {{ nodeVersion: string, npmVersion: string }} Normalized toolchain versions.
 */
function readToolchainContract() {
  const nodeVersion = readFileSync(join(repositoryRoot, '.nvmrc'), 'utf8')
    .trim()
    .replace(/^v/u, '');
  const rootManifest = JSON.parse(readFileSync(join(repositoryRoot, 'package.json'), 'utf8'));
  const packageManager = rootManifest.packageManager;

  if (!/^\d+\.\d+\.\d+$/u.test(nodeVersion)) {
    throw new Error(`.nvmrc must select an exact Node.js version; found ${nodeVersion || 'empty'}`);
  }

  if (typeof packageManager !== 'string') {
    throw new TypeError('package.json packageManager must be a string');
  }

  const npmVersionMatch = /^npm@(\d+\.\d+\.\d+)$/u.exec(packageManager);

  if (!npmVersionMatch) {
    throw new Error(`packageManager must select an exact npm version; found ${packageManager}`);
  }

  return { nodeVersion, npmVersion: npmVersionMatch[1] };
}

/**
 * Exposes the repository toolchain contract as outputs for later workflow steps.
 *
 * @param {{ nodeVersion: string, npmVersion: string }} contract Toolchain contract.
 */
function writeGithubOutputs(contract) {
  const outputPath = process.env.GITHUB_OUTPUT;

  if (!outputPath) {
    throw new Error('GITHUB_OUTPUT is required when exporting the toolchain contract');
  }

  appendFileSync(
    outputPath,
    `node-version=${contract.nodeVersion}\nnpm-version=${contract.npmVersion}\n`,
  );
}

main();
