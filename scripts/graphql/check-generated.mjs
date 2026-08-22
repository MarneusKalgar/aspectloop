#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { access, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const gatewayRoot = join(repositoryRoot, 'apps/gateway-api');
const gatewayGeneratorPath = join(gatewayRoot, 'scripts/generate-graphql-definitions.mjs');
const trackedGatewayOutput = join(gatewayRoot, 'src/graphql/generated/graphql.types.ts');
const trackedWebOutput = join(repositoryRoot, 'apps/web/src/graphql/generated');

/**
 * Checks tracked GraphQL artifacts without modifying the working tree.
 *
 * @returns {Promise<boolean>} True when every tracked artifact is current.
 */
async function checkGeneratedArtifacts() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'aspectloop-graphql-'));

  try {
    const generated = await generateTemporaryArtifacts(temporaryRoot);
    const diagnostics = await compareGeneratedFile(generated.gatewayOutput, trackedGatewayOutput);
    const webDiagnostics = await compareGeneratedDirectory(generated.webOutput, trackedWebOutput);
    diagnostics.push(...webDiagnostics);

    if (diagnostics.length === 0) {
      console.log('GraphQL generated artifacts are current.');
      return true;
    }

    console.error('GraphQL generated artifacts are stale:');
    for (const diagnostic of diagnostics) {
      console.error(`- ${diagnostic}`);
    }
    console.error('\nRun `npm run graphql:generate` and review the generated diff.');
    return false;
  } finally {
    await rm(temporaryRoot, { force: true, recursive: true });
  }
}

/**
 * Collects all files below a directory in stable relative-path order.
 *
 * @param {string} rootDirectory Directory used as the relative-path root.
 * @param {string} [currentDirectory] Directory currently being traversed.
 * @returns {Promise<string[]>} Sorted relative file paths.
 */
async function collectRelativeFiles(rootDirectory, currentDirectory = rootDirectory) {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(currentDirectory, entry.name);

    if (entry.isDirectory()) {
      const nestedFiles = await collectRelativeFiles(rootDirectory, entryPath);
      files.push(...nestedFiles);
      continue;
    }

    if (entry.isFile()) {
      files.push(relative(rootDirectory, entryPath).split(sep).join('/'));
    }
  }

  files.sort();
  return files;
}

/**
 * Compares generated and tracked directory file sets and contents.
 *
 * @param {string} generatedDirectory Temporary generated directory.
 * @param {string} trackedDirectory Tracked generated directory.
 * @returns {Promise<string[]>} File-level drift diagnostics.
 */
async function compareGeneratedDirectory(generatedDirectory, trackedDirectory) {
  const generatedFiles = await collectRelativeFiles(generatedDirectory);
  const trackedFiles = await collectRelativeFiles(trackedDirectory);
  const generatedFileSet = new Set(generatedFiles);
  const trackedFileSet = new Set(trackedFiles);
  const allFiles = [...new Set([...generatedFiles, ...trackedFiles])];
  const diagnostics = [];

  allFiles.sort();

  for (const relativePath of allFiles) {
    const trackedPath = join(trackedDirectory, relativePath);

    if (!generatedFileSet.has(relativePath)) {
      diagnostics.push(`unexpected tracked file: ${toRepositoryPath(trackedPath)}`);
      continue;
    }

    if (!trackedFileSet.has(relativePath)) {
      diagnostics.push(`missing tracked file: ${toRepositoryPath(trackedPath)}`);
      continue;
    }

    const fileDiagnostics = await compareGeneratedFile(
      join(generatedDirectory, relativePath),
      trackedPath,
    );
    diagnostics.push(...fileDiagnostics);
  }

  return diagnostics;
}

/**
 * Compares one generated file with its tracked counterpart.
 *
 * @param {string} generatedPath Temporary generated file path.
 * @param {string} trackedPath Tracked generated file path.
 * @returns {Promise<string[]>} Drift diagnostics for this file.
 */
async function compareGeneratedFile(generatedPath, trackedPath) {
  if (!(await fileExists(generatedPath))) {
    return [`generator did not emit: ${toRepositoryPath(trackedPath)}`];
  }

  if (!(await fileExists(trackedPath))) {
    return [`missing tracked file: ${toRepositoryPath(trackedPath)}`];
  }

  const generatedText = normalizeGeneratedText(await readFile(generatedPath, 'utf8'));
  const trackedText = normalizeGeneratedText(await readFile(trackedPath, 'utf8'));

  return generatedText === trackedText ? [] : [`content differs: ${toRepositoryPath(trackedPath)}`];
}

/**
 * Checks whether a generated artifact exists without masking other I/O errors.
 *
 * @param {string} filePath Absolute file path.
 * @returns {Promise<boolean>} True when the path is accessible.
 */
async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates gateway and web artifacts into an isolated temporary directory.
 *
 * @param {string} temporaryRoot Temporary generation root.
 * @returns {Promise<{ gatewayOutput: string, webOutput: string }>}
 */
async function generateTemporaryArtifacts(temporaryRoot) {
  const gatewayOutput = join(temporaryRoot, 'gateway/graphql.types.ts');
  const webOutput = join(temporaryRoot, 'web');
  const npmExecPath = process.env.npm_execpath;

  if (!npmExecPath) {
    throw new Error('GraphQL drift checking must run through `npm run graphql:check`.');
  }

  runCommand(process.execPath, [gatewayGeneratorPath, gatewayOutput], {
    cwd: gatewayRoot,
    label: 'gateway GraphQL generation',
  });
  runCommand(
    process.execPath,
    [npmExecPath, 'run', 'graphql-codegen', '--workspace', '@aspectloop/web', '--', '--silent'],
    {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        GQL_CODEGEN_LOCAL_SCHEMA: 'true',
        GQL_CODEGEN_OUTPUT_DIR: `${webOutput}${sep}`,
      },
      label: 'web GraphQL generation',
    },
  );

  return { gatewayOutput, webOutput };
}

/**
 * Normalizes platform line endings without masking generated content changes.
 *
 * @param {string} value Generated file content.
 * @returns {string} Line-ending-normalized content.
 */
function normalizeGeneratedText(value) {
  return value.replace(/\r\n?/gu, '\n');
}

/**
 * Runs a repository tool without inheriting noisy generator output.
 *
 * @param {string} command Executable path.
 * @param {string[]} args Executable arguments.
 * @param {{ cwd: string, env?: NodeJS.ProcessEnv, label: string }} options Execution options.
 * @returns {void}
 */
function runCommand(command, args, options) {
  const result = spawnSync(command, args, {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) {
    throw new Error(`${options.label} could not start: ${result.error.message}`);
  }

  if (result.status === 0) {
    return;
  }

  let details = '';
  const standardOutput = result.stdout.trim();
  const standardError = result.stderr.trim();

  if (standardOutput) {
    details += `\n${standardOutput}`;
  }

  if (standardError) {
    details += `\n${standardError}`;
  }

  throw new Error(`${options.label} failed with exit code ${result.status}.${details}`);
}

/**
 * Converts an absolute repository path into a stable slash-separated label.
 *
 * @param {string} filePath Absolute file path.
 * @returns {string} Repository-relative display path.
 */
function toRepositoryPath(filePath) {
  return relative(repositoryRoot, filePath).split(sep).join('/');
}

try {
  const isCurrent = await checkGeneratedArtifacts();

  if (!isCurrent) {
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  console.error(`GraphQL generated-artifact check failed: ${message}`);
  process.exitCode = 1;
}
