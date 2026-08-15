#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REQUIRED_NPM_CONFIG } from './dependency-policy.config.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const rootManifestPath = join(repositoryRoot, 'package.json');
const lockfilePath = join(repositoryRoot, 'package-lock.json');
const npmrcPath = join(repositoryRoot, '.npmrc');
const errors = [];

/**
 * Reads and parses a JSON file used by the dependency policy.
 *
 * @param {string} filePath Absolute path to the JSON file.
 * @returns {Record<string, unknown>} Parsed JSON object.
 */
function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

/**
 * Parses project npm configuration into a normalized key/value map.
 *
 * @param {string} filePath Absolute path to the project `.npmrc`.
 * @returns {Map<string, string>} Last configured value for each npm key.
 */
function readNpmConfig(filePath) {
  const config = new Map();
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/u);

  for (const sourceLine of lines) {
    const line = sourceLine.trim();

    if (!line || line.startsWith('#') || line.startsWith(';')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');

    if (separatorIndex < 1) {
      errors.push(`.npmrc contains an invalid entry: ${sourceLine}`);
      continue;
    }

    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    config.set(key, value);
  }

  return config;
}

/**
 * Verifies that the committed npm policy has not been weakened or bypassed.
 *
 * @param {Map<string, string>} config Parsed project npm configuration.
 * @returns {void}
 */
function validateNpmPolicy(config) {
  for (const [key, expectedValue] of Object.entries(REQUIRED_NPM_CONFIG)) {
    const actualValue = config.get(key);

    if (actualValue !== expectedValue) {
      errors.push(
        `.npmrc must set ${key}=${expectedValue}; found ${actualValue ?? 'missing'}`,
      );
    }
  }

  if (config.get('ignore-scripts') === 'true') {
    errors.push('.npmrc must not set ignore-scripts=true');
  }

  if (config.get('dangerously-allow-all-scripts') === 'true') {
    errors.push('.npmrc must not bypass the install-script policy');
  }
}

/**
 * Resolves root and workspace package manifests from the root workspace list.
 *
 * @param {Record<string, unknown>} rootManifest Parsed root package manifest.
 * @returns {string[]} Absolute package manifest paths.
 */
function collectManifestPaths(rootManifest) {
  const manifestPaths = [rootManifestPath];
  const workspaces = rootManifest.workspaces;

  if (!Array.isArray(workspaces)) {
    errors.push('package.json workspaces must be an array');
    return manifestPaths;
  }

  for (const workspacePattern of workspaces) {
    if (typeof workspacePattern !== 'string') {
      errors.push('package.json contains a non-string workspace pattern');
      continue;
    }

    if (workspacePattern.endsWith('/*') && workspacePattern.indexOf('*') === workspacePattern.length - 1) {
      const workspaceRoot = join(repositoryRoot, workspacePattern.slice(0, -2));

      if (!existsSync(workspaceRoot)) {
        errors.push(`workspace root does not exist: ${workspacePattern}`);
        continue;
      }

      const entries = readdirSync(workspaceRoot, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const manifestPath = join(workspaceRoot, entry.name, 'package.json');

        if (existsSync(manifestPath)) {
          manifestPaths.push(manifestPath);
        }
      }

      continue;
    }

    if (workspacePattern.includes('*')) {
      errors.push(`unsupported workspace pattern in policy checker: ${workspacePattern}`);
      continue;
    }

    const manifestPath = join(repositoryRoot, workspacePattern, 'package.json');

    if (existsSync(manifestPath)) {
      manifestPaths.push(manifestPath);
    } else {
      errors.push(`workspace manifest does not exist: ${workspacePattern}`);
    }
  }

  return manifestPaths;
}

/**
 * Collects known workspace package names and relative directories.
 *
 * @param {string[]} manifestPaths Absolute workspace manifest paths.
 * @returns {{ names: Set<string>, paths: Set<string> }} Known workspace identities.
 */
function collectWorkspaceIdentity(manifestPaths) {
  const names = new Set();
  const paths = new Set();

  for (const manifestPath of manifestPaths) {
    if (manifestPath === rootManifestPath) {
      continue;
    }

    const manifest = readJson(manifestPath);

    if (typeof manifest.name === 'string') {
      names.add(manifest.name);
    }

    paths.add(relative(repositoryRoot, dirname(manifestPath)).replaceAll('\\', '/'));
  }

  return { names, paths };
}

/**
 * Classifies a dependency spec that violates the registry/workspace policy.
 *
 * @param {string} dependencyName Manifest dependency name.
 * @param {string} spec Manifest dependency specification.
 * @param {Set<string>} workspaceNames Known workspace package names.
 * @returns {string | null} Violation description, or null when permitted.
 */
function classifyDisallowedSpec(dependencyName, spec, workspaceNames) {
  if (spec.startsWith('workspace:')) {
    return workspaceNames.has(dependencyName)
      ? null
      : 'workspace protocol references an unknown workspace';
  }

  if (spec.startsWith('file:')) {
    return 'local file or directory source';
  }

  if (/^https?:/iu.test(spec)) {
    return 'remote URL source';
  }

  if (/^(?:git(?:\+[^:]+)?:|git@|ssh:|github:|gitlab:|bitbucket:)/iu.test(spec)) {
    return 'git source';
  }

  if (/^(?:\.{1,2}(?:[/\\]|$)|~[/\\]|[/\\]|[A-Za-z]:[/\\])/u.test(spec)) {
    return 'directory source';
  }

  if (/^[^@./\s][^/\s]*\/[^/\s]+(?:#.*)?$/u.test(spec)) {
    return 'repository shorthand source';
  }

  return null;
}

/**
 * Rejects prohibited dependency specifications in every workspace manifest.
 *
 * @param {string[]} manifestPaths Absolute manifest paths to inspect.
 * @param {Set<string>} workspaceNames Known workspace package names.
 * @returns {void}
 */
function validateManifestSources(manifestPaths, workspaceNames) {
  const dependencySections = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ];

  for (const manifestPath of manifestPaths) {
    const manifest = readJson(manifestPath);

    for (const section of dependencySections) {
      const dependencies = manifest[section];

      if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
        continue;
      }

      for (const [dependencyName, spec] of Object.entries(dependencies)) {
        if (typeof spec !== 'string') {
          errors.push(`${relative(repositoryRoot, manifestPath)} has a non-string ${section} spec for ${dependencyName}`);
          continue;
        }

        const violation = classifyDisallowedSpec(dependencyName, spec, workspaceNames);

        if (violation) {
          errors.push(
            `${relative(repositoryRoot, manifestPath)}: ${dependencyName} uses prohibited ${violation} (${spec})`,
          );
        }
      }
    }
  }
}

/**
 * Validates resolved lockfile sources while preserving known workspace links.
 *
 * @param {Record<string, unknown>} lockfile Parsed package lockfile.
 * @param {Set<string>} workspacePaths Known workspace directories.
 * @param {Map<string, string>} npmConfig Parsed npm configuration.
 * @returns {void}
 */
function validateLockfileSources(lockfile, workspacePaths, npmConfig) {
  const packages = lockfile.packages;

  if (!packages || typeof packages !== 'object' || Array.isArray(packages)) {
    errors.push('package-lock.json does not contain a packages object');
    return;
  }

  const registryValue = npmConfig.get('registry') ?? 'https://registry.npmjs.org/';
  let registryOrigin;

  try {
    registryOrigin = new URL(registryValue).origin;
  } catch {
    errors.push(`.npmrc registry is not a valid URL: ${registryValue}`);
    return;
  }

  for (const [lockPath, packageData] of Object.entries(packages)) {
    if (!packageData || typeof packageData !== 'object' || Array.isArray(packageData)) {
      continue;
    }

    const resolvedSource = packageData.resolved;
    const isWorkspaceLink = packageData.link === true;

    if (isWorkspaceLink) {
      if (typeof resolvedSource !== 'string' || !workspacePaths.has(resolvedSource)) {
        errors.push(`${lockPath || '<root>'} links to an unknown workspace source`);
      }

      continue;
    }

    if (typeof resolvedSource !== 'string') {
      continue;
    }

    if (/^https?:/iu.test(resolvedSource)) {
      let resolvedUrl;

      try {
        resolvedUrl = new URL(resolvedSource);
      } catch {
        errors.push(`${lockPath} contains an invalid resolved URL: ${resolvedSource}`);
        continue;
      }

      if (resolvedUrl.origin !== registryOrigin) {
        errors.push(`${lockPath} resolves outside the configured registry: ${resolvedSource}`);
      }

      continue;
    }

    errors.push(`${lockPath} resolves from a prohibited non-registry source: ${resolvedSource}`);
  }
}

/**
 * Derives a dependency package name from a package-lock packages key.
 *
 * @param {string} lockPath Package-lock packages key.
 * @returns {string | null} Package name, including scope when present.
 */
function derivePackageName(lockPath) {
  const marker = 'node_modules/';
  const markerIndex = lockPath.lastIndexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  return lockPath.slice(markerIndex + marker.length);
}

/**
 * Determines whether npm-generated policy covers one dependency script.
 *
 * @param {Record<string, unknown>} allowScripts Root allowScripts policy.
 * @param {string} packageName Dependency package name.
 * @param {string} version Installed package version.
 * @returns {boolean} True when an approval or denial covers the dependency.
 */
function isInstallScriptCovered(allowScripts, packageName, version) {
  const exactKey = `${packageName}@${version}`;

  if (Object.prototype.hasOwnProperty.call(allowScripts, exactKey)) {
    const decision = allowScripts[exactKey];

    if (typeof decision !== 'boolean') {
      errors.push(`allowScripts.${exactKey} must be a boolean`);
      return false;
    }

    return true;
  }

  if (!Object.prototype.hasOwnProperty.call(allowScripts, packageName)) {
    return false;
  }

  const decision = allowScripts[packageName];

  if (typeof decision !== 'boolean') {
    errors.push(`allowScripts.${packageName} must be a boolean`);
    return false;
  }

  if (decision) {
    errors.push(`${packageName} has an unpinned install-script approval; approve the reviewed version instead`);
  }

  return true;
}

/**
 * Reports dependencies whose install scripts lack a reviewed policy decision.
 *
 * @param {Record<string, unknown>} rootManifest Parsed root package manifest.
 * @param {Record<string, unknown>} lockfile Parsed package lockfile.
 * @returns {void}
 */
function validateInstallScripts(rootManifest, lockfile) {
  const configuredPolicy = rootManifest.allowScripts;
  const allowScripts =
    configuredPolicy && typeof configuredPolicy === 'object' && !Array.isArray(configuredPolicy)
      ? configuredPolicy
      : {};

  if (configuredPolicy !== undefined && allowScripts !== configuredPolicy) {
    errors.push('package.json allowScripts must be an object generated by npm');
  }

  const packages = lockfile.packages;

  if (!packages || typeof packages !== 'object' || Array.isArray(packages)) {
    return;
  }

  const reported = new Set();

  for (const [lockPath, packageData] of Object.entries(packages)) {
    if (
      !packageData ||
      typeof packageData !== 'object' ||
      Array.isArray(packageData) ||
      packageData.hasInstallScript !== true
    ) {
      continue;
    }

    const packageName = derivePackageName(lockPath);
    const version = packageData.version;

    if (!packageName || typeof version !== 'string') {
      errors.push(`${lockPath} has an install script but no policy-checkable identity`);
      continue;
    }

    const identity = `${packageName}@${version}`;

    if (reported.has(identity)) {
      continue;
    }

    reported.add(identity);

    if (!isInstallScriptCovered(allowScripts, packageName, version)) {
      errors.push(`${identity} has an install script not covered by allowScripts`);
    }
  }
}

if (!existsSync(lockfilePath)) {
  errors.push('package-lock.json is required');
}

const rootManifest = readJson(rootManifestPath);
const npmConfig = readNpmConfig(npmrcPath);
const manifestPaths = collectManifestPaths(rootManifest);
const workspaceIdentity = collectWorkspaceIdentity(manifestPaths);

validateNpmPolicy(npmConfig);
validateManifestSources(manifestPaths, workspaceIdentity.names);

if (existsSync(lockfilePath)) {
  const lockfile = readJson(lockfilePath);
  validateLockfileSources(lockfile, workspaceIdentity.paths, npmConfig);
  validateInstallScripts(rootManifest, lockfile);
}

if (errors.length > 0) {
  console.error('Dependency policy check failed:');

  for (const error of errors) {
    console.error(`- ${error}`);
  }

  console.error(
    'Review dependency sources or run `npm install-scripts ls` and record decisions with npm.',
  );
  process.exitCode = 1;
} else {
  console.log('Dependency source and install-script policy checks passed.');
}
