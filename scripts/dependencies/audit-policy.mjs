const advisoryUrl = 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm';
const expiresAt = Date.parse('2026-10-17T00:00:00Z');
const expectedParents = {
  '@graphql-codegen/cli': [
    '@graphql-tools/code-file-loader',
    '@graphql-tools/git-loader',
    '@graphql-tools/graphql-file-loader',
    '@graphql-tools/json-file-loader',
    'graphql-config',
    'micromatch',
  ],
  '@graphql-tools/code-file-loader': ['globby'],
  '@graphql-tools/git-loader': ['micromatch'],
  '@graphql-tools/graphql-file-loader': ['globby'],
  '@graphql-tools/json-file-loader': ['globby'],
  braces: [],
  'fast-glob': ['micromatch'],
  globby: ['fast-glob'],
  'graphql-config': ['@graphql-tools/graphql-file-loader', '@graphql-tools/json-file-loader'],
  micromatch: ['braces'],
};
const expectedPackages = new Set(Object.keys(expectedParents));

/**
 * Checks the audit report against the temporary, dev-only braces exception.
 *
 * @param {unknown} report Parsed npm audit JSON report.
 * @param {unknown} lockfile Parsed npm lockfile.
 * @param {Date} now Current time, injectable for policy tests.
 * @returns {{ allowed: boolean, errors: string[] }} Policy decision and reasons.
 */
export function evaluateAuditReport(report, lockfile, now = new Date()) {
  const errors = [];

  if (!isRecord(report) || report.auditReportVersion !== 2 || !isRecord(report.vulnerabilities)) {
    return {
      allowed: false,
      errors: ['npm audit did not return a version 2 vulnerability report'],
    };
  }

  if (report.error || !isRecord(report.metadata) || !isRecord(report.metadata.vulnerabilities)) {
    return { allowed: false, errors: ['npm audit returned an error or incomplete summary'] };
  }

  if (!isRecord(lockfile) || !isRecord(lockfile.packages)) {
    return { allowed: false, errors: ['package-lock.json does not contain package records'] };
  }

  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || now.getTime() >= expiresAt) {
    errors.push('the braces exception expired on 2026-10-17 UTC');
  }

  const packages = lockfile.packages;
  const braces = packages['node_modules/braces'];

  if (!isRecord(braces) || braces.version !== '3.0.3' || braces.dev !== true) {
    errors.push('the exception requires dev-only braces@3.0.3 at node_modules/braces');
  }

  const vulnerabilities = report.vulnerabilities;
  const counts = report.metadata.vulnerabilities;
  const severities = ['info', 'low', 'moderate', 'high', 'critical'];
  const observedCounts = { critical: 0, high: 0, info: 0, low: 0, moderate: 0 };
  const highNames = Object.keys(vulnerabilities).filter((name) => {
    const vulnerability = vulnerabilities[name];
    return isRecord(vulnerability) && ['critical', 'high'].includes(vulnerability.severity);
  });

  for (const [name, vulnerability] of Object.entries(vulnerabilities)) {
    if (!isRecord(vulnerability) || !severities.includes(vulnerability.severity)) {
      errors.push(`malformed vulnerability record: ${name}`);
      continue;
    }

    observedCounts[vulnerability.severity] += 1;
  }

  for (const severity of severities) {
    if (!Number.isSafeInteger(counts[severity]) || counts[severity] !== observedCounts[severity]) {
      errors.push(`npm audit summary does not match ${severity} vulnerability records`);
    }
  }

  if (!Number.isSafeInteger(counts.total) || counts.total !== Object.keys(vulnerabilities).length) {
    errors.push('npm audit summary does not match the total vulnerability records');
  }

  if (highNames.length !== expectedPackages.size) {
    errors.push('the high/critical package set differs from the reviewed braces chain');
  }

  for (const name of highNames) {
    if (!expectedPackages.has(name)) {
      errors.push(`unreviewed high/critical vulnerability: ${name}`);
    }
  }

  for (const name of expectedPackages) {
    if (!highNames.includes(name)) {
      errors.push(`the reviewed braces chain is missing: ${name}; remove or revise the exception`);
      continue;
    }

    const vulnerability = vulnerabilities[name];

    if (
      !isRecord(vulnerability) ||
      vulnerability.name !== name ||
      vulnerability.severity !== 'high'
    ) {
      errors.push(`unexpected vulnerability record for ${name}`);
      continue;
    }

    if (!Array.isArray(vulnerability.nodes) || vulnerability.nodes.length !== 1) {
      errors.push(`unexpected installed nodes for ${name}`);
      continue;
    }

    const nodePath = `node_modules/${name}`;
    const node = packages[nodePath];

    if (vulnerability.nodes[0] !== nodePath || !isRecord(node) || node.dev !== true) {
      errors.push(`${name} is not confined to the reviewed development dependency path`);
    }

    if (!Array.isArray(vulnerability.via) || vulnerability.via.length === 0) {
      errors.push(`missing advisory path for ${name}`);
      continue;
    }

    if (name === 'braces') {
      if (
        vulnerability.via.length !== 1 ||
        !isRecord(vulnerability.via[0]) ||
        vulnerability.via[0].name !== 'braces' ||
        vulnerability.via[0].url !== advisoryUrl ||
        vulnerability.via[0].severity !== 'high'
      ) {
        errors.push('braces has an unreviewed or changed advisory');
      }
      continue;
    }

    const observedParents = vulnerability.via;
    const reviewedParents = expectedParents[name];

    if (
      observedParents.length !== reviewedParents.length ||
      new Set(observedParents).size !== reviewedParents.length ||
      !observedParents.every(
        (parent) => typeof parent === 'string' && reviewedParents.includes(parent),
      )
    ) {
      errors.push(`${name} has an unreviewed advisory or dependency path`);
    }
  }

  for (const name of expectedPackages) {
    if (name === 'braces' || !highNames.includes(name)) {
      continue;
    }

    if (!reachesBraces(name, vulnerabilities, new Set())) {
      errors.push(`${name} does not resolve solely to the reviewed braces advisory`);
    }
  }

  return { allowed: errors.length === 0, errors };
}

/**
 * Narrows an unknown parsed JSON value to a non-array object.
 *
 * @param {unknown} value Parsed JSON value.
 * @returns {value is Record<string, unknown>} Whether the value is a record.
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Ensures every advisory path for a package terminates at braces without cycles.
 *
 * @param {string} name Vulnerable package name.
 * @param {Record<string, unknown>} vulnerabilities Audit vulnerability records.
 * @param {Set<string>} ancestors Package names already visited on this path.
 * @returns {boolean} Whether every parent path reaches braces.
 */
function reachesBraces(name, vulnerabilities, ancestors) {
  if (name === 'braces') {
    return true;
  }

  if (ancestors.has(name)) {
    return false;
  }

  const vulnerability = vulnerabilities[name];

  if (
    !isRecord(vulnerability) ||
    !Array.isArray(vulnerability.via) ||
    vulnerability.via.length === 0
  ) {
    return false;
  }

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(name);

  return vulnerability.via.every(
    (parent) =>
      typeof parent === 'string' &&
      expectedPackages.has(parent) &&
      reachesBraces(parent, vulnerabilities, nextAncestors),
  );
}
