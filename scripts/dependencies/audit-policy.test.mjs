import assert from 'node:assert/strict';
import test from 'node:test';

import { evaluateAuditReport } from './audit-policy.mjs';

const parents = {
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
  braces: [
    {
      name: 'braces',
      severity: 'high',
      url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
    },
  ],
  'fast-glob': ['micromatch'],
  globby: ['fast-glob'],
  'graphql-config': ['@graphql-tools/graphql-file-loader', '@graphql-tools/json-file-loader'],
  micromatch: ['braces'],
};

/**
 * Verifies that the exception is exact, temporary, and fails closed on drift.
 *
 * @returns {void} Asserts policy outcomes.
 */
function checksTemporaryException() {
  const beforeExpiry = new Date('2026-10-03T00:00:00Z');
  const valid = createFixture();
  assert.equal(evaluateAuditReport(valid.report, valid.lockfile, beforeExpiry).allowed, true);

  const expired = createFixture();
  assert.equal(
    evaluateAuditReport(expired.report, expired.lockfile, new Date('2026-10-17T00:00:00Z')).allowed,
    false,
  );

  const production = createFixture();
  production.lockfile.packages['node_modules/braces'].dev = false;
  assert.equal(
    evaluateAuditReport(production.report, production.lockfile, beforeExpiry).allowed,
    false,
  );

  const newAdvisory = createFixture();
  newAdvisory.report.vulnerabilities.braces.via.push({
    name: 'braces',
    severity: 'high',
    url: 'https://github.com/advisories/GHSA-unreviewed',
  });
  assert.equal(
    evaluateAuditReport(newAdvisory.report, newAdvisory.lockfile, beforeExpiry).allowed,
    false,
  );

  const mixedParent = createFixture();
  mixedParent.report.vulnerabilities.micromatch.via.push({
    name: 'micromatch',
    severity: 'high',
    url: 'https://github.com/advisories/GHSA-unreviewed',
  });
  assert.equal(
    evaluateAuditReport(mixedParent.report, mixedParent.lockfile, beforeExpiry).allowed,
    false,
  );

  const changedParent = createFixture();
  changedParent.report.vulnerabilities['@graphql-tools/code-file-loader'].via = ['micromatch'];
  assert.equal(
    evaluateAuditReport(changedParent.report, changedParent.lockfile, beforeExpiry).allowed,
    false,
  );

  const newHigh = createFixture();
  newHigh.report.vulnerabilities.other = {
    name: 'other',
    nodes: ['node_modules/other'],
    severity: 'high',
    via: [{ name: 'other', severity: 'high', url: 'https://github.com/advisories/GHSA-other' }],
  };
  newHigh.report.metadata.vulnerabilities.high = 11;
  newHigh.report.metadata.vulnerabilities.total = 11;
  assert.equal(evaluateAuditReport(newHigh.report, newHigh.lockfile, beforeExpiry).allowed, false);

  const missing = createFixture();
  delete missing.report.vulnerabilities.braces;
  missing.report.metadata.vulnerabilities.high = 9;
  missing.report.metadata.vulnerabilities.total = 9;
  assert.equal(evaluateAuditReport(missing.report, missing.lockfile, beforeExpiry).allowed, false);

  const malformed = createFixture();
  malformed.report.error = { code: 'EAUDITNOLOCK' };
  assert.equal(
    evaluateAuditReport(malformed.report, malformed.lockfile, beforeExpiry).allowed,
    false,
  );

  const incomplete = createFixture();
  delete incomplete.report.metadata.vulnerabilities.total;
  assert.equal(
    evaluateAuditReport(incomplete.report, incomplete.lockfile, beforeExpiry).allowed,
    false,
  );

  const cycle = createFixture();
  cycle.report.vulnerabilities.micromatch.via = ['fast-glob'];
  assert.equal(evaluateAuditReport(cycle.report, cycle.lockfile, beforeExpiry).allowed, false);
}

/**
 * Builds a minimal report and lockfile for the reviewed advisory chain.
 *
 * @returns {{ report: Record<string, unknown>, lockfile: Record<string, unknown> }} Fixture pair.
 */
function createFixture() {
  const vulnerabilities = {};
  const packages = {};

  for (const [name, via] of Object.entries(parents)) {
    vulnerabilities[name] = {
      name,
      nodes: [`node_modules/${name}`],
      severity: 'high',
      via: structuredClone(via),
    };
    packages[`node_modules/${name}`] = {
      dev: true,
      version: name === 'braces' ? '3.0.3' : '1.0.0',
    };
  }

  return {
    lockfile: { packages },
    report: {
      auditReportVersion: 2,
      metadata: {
        vulnerabilities: { critical: 0, high: 10, info: 0, low: 0, moderate: 0, total: 10 },
      },
      vulnerabilities,
    },
  };
}

test('temporary braces audit exception remains tightly scoped', checksTemporaryException);
