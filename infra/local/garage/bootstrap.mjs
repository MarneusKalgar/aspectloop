import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { parseEnv } from 'node:util';

import {
  ACCESS_DENIED_STATUS,
  ACCESS_KEY_ID_PATTERN,
  CLI_TIMEOUT_MS,
  COMPOSE_PROJECT_NAME_PATTERN,
  DEFAULT_ASSIGNMENTS,
  ENV_FILE,
  GARAGE_OWNERS,
  GARAGE_ZONE_PATTERN,
  HEALTHY_STATUS,
  LAYOUT_VERSION,
  LOCAL_GARAGE_REGION,
  MAX_PORT,
  OPERATION_TIMEOUT_MS,
  READINESS_ATTEMPTS,
  READINESS_DELAY_MS,
  S3_BUCKET_NAME_PATTERN,
  SECRET_PATTERN,
  UNAVAILABLE_STATUS,
} from './constants.mjs';
import { errorName, positiveInteger, required } from './utils.mjs';

/**
 * @typedef {object} GarageService
 * @property {string} accessKeyId - Garage access-key identifier.
 * @property {string} bucket - Private bucket owned by the service.
 * @property {string} name - Lowercase service owner name.
 * @property {string} secretAccessKey - Garage secret access key.
 */

/**
 * @typedef {object} GarageConfiguration
 * @property {string} adminEndpoint - Host-side Garage Admin API endpoint.
 * @property {number} capacity - Single-node storage capacity in bytes.
 * @property {string} containerName - Deterministic local Garage container name.
 * @property {string} endpoint - Host-side Garage S3 endpoint.
 * @property {string} region - Garage S3 region.
 * @property {GarageService[]} services - Bucket and credential contracts by owner.
 * @property {string} zone - Single-node Garage zone.
 */

let step = 'configuration';

/**
 * Calls one fixed Garage JSON API operation through the running scratch container.
 *
 * @param {string} containerName - Garage container name.
 * @param {string} operation - Garage JSON API operation.
 * @param {unknown} [payload=null] - Operation payload sent through stdin.
 * @returns {any} Parsed Garage JSON API response.
 */
function admin(containerName, operation, payload = null) {
  step = `Garage ${operation}`;

  const output = execFileSync(
    'docker',
    ['exec', '-i', containerName, '/garage', 'json-api', operation, '-'],
    {
      encoding: 'utf8',
      input: JSON.stringify(payload),
      maxBuffer: 1024 * 1024,
      stdio: 'pipe',
      timeout: CLI_TIMEOUT_MS,
    },
  );

  return JSON.parse(output);
}

/**
 * Creates only the three configured private buckets and returns their stable identifiers.
 *
 * @param {string} containerName - Garage container name.
 * @param {GarageService[]} services - Expected service storage contracts.
 * @returns {Map<string, string>} Bucket identifier keyed by configured alias.
 */
function bootstrapBuckets(containerName, services) {
  const bucketIds = new Map();
  const existingBuckets = admin(containerName, 'ListBuckets');
  assert.ok(existingBuckets.length <= services.length, 'Unexpected Garage bucket count');

  for (const candidate of existingBuckets) {
    assert.equal(candidate.globalAliases.length, 1, 'Unexpected Garage bucket aliases');

    let configured = false;

    for (const service of services) {
      if (candidate.globalAliases[0] === service.bucket) {
        configured = true;
      }
    }

    assert.equal(configured, true, 'Unexpected Garage bucket');
    bucketIds.set(candidate.globalAliases[0], candidate.id);
  }

  for (const service of services) {
    if (!bucketIds.has(service.bucket)) {
      const created = admin(containerName, 'CreateBucket', { globalAlias: service.bucket });
      bucketIds.set(service.bucket, created.id);
    }
  }

  return bucketIds;
}

/**
 * Imports each service key once and validates all existing key identities.
 *
 * @param {string} containerName - Garage container name.
 * @param {GarageService[]} services - Expected service storage contracts.
 * @returns {void}
 */
function bootstrapKeys(containerName, services) {
  const existingKeys = admin(containerName, 'ListKeys');
  assert.ok(existingKeys.length <= services.length, 'Unexpected Garage access-key count');

  for (const key of existingKeys) {
    const service = serviceForAccessKey(services, key.id);
    assert.ok(service, 'Unexpected Garage access key');
    assert.equal(key.name, `${service.name}-service`, 'Unexpected Garage key name');
    assert.equal(key.expired, false, 'Garage service key has expired');
  }

  for (const service of services) {
    let exists = false;

    for (const key of existingKeys) {
      if (key.id === service.accessKeyId) {
        exists = true;
      }
    }

    if (!exists) {
      admin(containerName, 'ImportKey', {
        accessKeyId: service.accessKeyId,
        name: `${service.name}-service`,
        secretAccessKey: service.secretAccessKey,
      });
    }
  }
}

/**
 * Applies exactly one local storage role and rejects an unexpected existing layout.
 *
 * @param {string} containerName - Garage container name.
 * @param {any} status - Garage cluster status response.
 * @param {string} zone - Expected local Garage zone.
 * @param {number} configuredCapacity - Expected storage capacity in bytes.
 * @returns {void}
 */
function bootstrapLayout(containerName, status, zone, configuredCapacity) {
  assert.equal(status.nodes.length, 1, 'Expected exactly one Garage node');

  const node = status.nodes[0];
  assert.equal(node.isUp, true, 'Garage node is disconnected');

  const layout = admin(containerName, 'GetClusterLayout');
  assert.equal(layout.stagedRoleChanges.length, 0, 'Unexpected staged Garage layout changes');

  if (layout.version === 0 && layout.roles.length === 0) {
    admin(containerName, 'UpdateClusterLayout', {
      roles: [{ capacity: configuredCapacity, id: node.id, tags: [], zone }],
    });
    admin(containerName, 'ApplyClusterLayout', { version: LAYOUT_VERSION });
  }

  const applied = admin(containerName, 'GetClusterLayout');

  assert.equal(applied.version, LAYOUT_VERSION, 'Unexpected Garage layout version');
  assert.equal(applied.roles.length, 1, 'Unexpected Garage storage-node count');
  assert.equal(applied.roles[0].id, node.id, 'Unexpected Garage storage node');
  assert.equal(applied.roles[0].zone, zone, 'Unexpected Garage storage zone');
  assert.equal(applied.roles[0].capacity, configuredCapacity, 'Unexpected Garage storage capacity');
}

/**
 * Loads and validates the normal-stack Garage topology and service credentials.
 *
 * @returns {GarageConfiguration} Validated Garage bootstrap configuration.
 */
function configuration() {
  const environment = parseEnv(readFileSync(ENV_FILE, 'utf8'));
  const project = required(environment, 'COMPOSE_PROJECT_NAME');
  const host = required(environment, 'GARAGE_HOST');
  const zone = required(environment, 'GARAGE_ZONE');

  assert.match(project, COMPOSE_PROJECT_NAME_PATTERN, 'Invalid Compose project name');
  assert.equal(host, DEFAULT_ASSIGNMENTS.GARAGE_HOST, 'GARAGE_HOST must remain loopback-only');
  assert.match(zone, GARAGE_ZONE_PATTERN, 'Invalid Garage zone');

  const configuredCapacity = positiveInteger(
    environment,
    'GARAGE_CAPACITY_BYTES',
    Number.MAX_SAFE_INTEGER,
  );

  /**
   * @type {GarageService[]}
   */
  const services = [];
  const bucketNames = new Set();
  const accessKeyIds = new Set();
  const secretAccessKeys = new Set();

  for (const owner of GARAGE_OWNERS) {
    const bucket = required(environment, `${owner}_S3_BUCKET`);
    const accessKeyId = required(environment, `${owner}_S3_ACCESS_KEY_ID`);
    const secretAccessKey = required(environment, `${owner}_S3_SECRET_ACCESS_KEY`);

    assert.match(bucket, S3_BUCKET_NAME_PATTERN, `Invalid ${owner} bucket`);
    assert.match(accessKeyId, ACCESS_KEY_ID_PATTERN, `Invalid ${owner} access key`);
    assert.match(secretAccessKey, SECRET_PATTERN, `Invalid ${owner} secret key`);

    bucketNames.add(bucket);
    accessKeyIds.add(accessKeyId);
    secretAccessKeys.add(secretAccessKey);
    services.push({ accessKeyId, bucket, name: owner.toLowerCase(), secretAccessKey });
  }

  assert.equal(bucketNames.size, services.length, 'Garage bucket names must be distinct');
  assert.equal(accessKeyIds.size, services.length, 'Garage access keys must be distinct');
  assert.equal(secretAccessKeys.size, services.length, 'Garage secret keys must be distinct');

  return {
    adminEndpoint: `http://${host}:${positiveInteger(environment, 'GARAGE_ADMIN_PORT', MAX_PORT)}`,
    capacity: configuredCapacity,
    containerName: `${project}-garage`,
    endpoint: `http://${host}:${positiveInteger(environment, 'GARAGE_S3_PORT', MAX_PORT)}`,
    region: LOCAL_GARAGE_REGION,
    services,
    zone,
  };
}

/**
 * Creates one explicit Garage S3 client without retries or ambient credentials.
 *
 * @param {GarageConfiguration} configurationValue - Validated Garage configuration.
 * @param {GarageService} service - Credential owner for the client.
 * @returns {S3Client} Configured S3 client.
 */
function createS3Client(configurationValue, service) {
  return new S3Client({
    credentials: {
      accessKeyId: service.accessKeyId,
      secretAccessKey: service.secretAccessKey,
    },
    endpoint: configurationValue.endpoint,
    forcePathStyle: true,
    maxAttempts: 1,
    region: configurationValue.region,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

/**
 * Extracts an HTTP status from an SDK failure without logging its request details.
 *
 * @param {unknown} error - AWS SDK failure.
 * @returns {number | undefined} HTTP status when available.
 */
function errorStatus(error) {
  if (!error || typeof error !== 'object' || !('$metadata' in error)) {
    return undefined;
  }

  const metadata = error.$metadata;

  if (!metadata || typeof metadata !== 'object' || !('httpStatusCode' in metadata)) {
    return undefined;
  }

  return typeof metadata.httpStatusCode === 'number' ? metadata.httpStatusCode : undefined;
}

/**
 * Executes deterministic layout, key, bucket, grant, and S3 readiness bootstrap.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const configurationValue = configuration();
  const status = await waitForStatus(configurationValue.containerName);

  bootstrapLayout(
    configurationValue.containerName,
    status,
    configurationValue.zone,
    configurationValue.capacity,
  );

  bootstrapKeys(configurationValue.containerName, configurationValue.services);

  const bucketIds = bootstrapBuckets(configurationValue.containerName, configurationValue.services);
  reconcileBucketGrants(configurationValue.containerName, configurationValue.services, bucketIds);

  await waitForHealth(configurationValue.adminEndpoint);
  await verifyS3(configurationValue);
  console.log('Garage bootstrap ready: layout v1, three private buckets, three isolated keys.');
}

/**
 * Removes every managed key/bucket permission before applying the intended matrix.
 * Garage permission updates only change flags set to true, so reconciliation must
 * explicitly revoke stale grants before allowing each owner access to its bucket.
 *
 * @param {string} containerName - Garage container name.
 * @param {GarageService[]} services - Expected service storage contracts.
 * @param {Map<string, string>} bucketIds - Bucket identifiers by alias.
 * @returns {void}
 */
function reconcileBucketGrants(containerName, services, bucketIds) {
  for (const service of services) {
    for (const bucketId of bucketIds.values()) {
      admin(containerName, 'DenyBucketKey', {
        accessKeyId: service.accessKeyId,
        bucketId,
        permissions: { owner: true, read: true, write: true },
      });
    }
  }

  for (const service of services) {
    admin(containerName, 'AllowBucketKey', {
      accessKeyId: service.accessKeyId,
      bucketId: bucketIds.get(service.bucket),
      permissions: { owner: false, read: true, write: true },
    });
  }
}

/**
 * Removes a permission probe with the bucket owner's credentials if a stale
 * peer write grant unexpectedly allowed the probe to be created.
 *
 * @param {GarageConfiguration} configurationValue - Validated Garage configuration.
 * @param {GarageService} owner - Owner of the probed bucket.
 * @param {string} key - Probe object key.
 * @returns {Promise<void>}
 */
async function removePermissionProbe(configurationValue, owner, key) {
  const ownerClient = createS3Client(configurationValue, owner);

  try {
    await send(ownerClient, new DeleteObjectCommand({ Bucket: owner.bucket, Key: key }));
  } finally {
    ownerClient.destroy();
  }
}

/**
 * Sends one bounded S3 request without retries or ambient credentials.
 *
 * @param {S3Client} client - Explicitly configured Garage S3 client.
 * @param {HeadBucketCommand | PutObjectCommand | DeleteObjectCommand} command -
 * Bounded S3 command.
 * @returns {Promise<unknown>} AWS SDK command result.
 */
function send(client, command) {
  return client.send(command, { abortSignal: AbortSignal.timeout(OPERATION_TIMEOUT_MS) });
}

/**
 * Finds the configured owner for an access key without accepting unknown cluster keys.
 *
 * @param {GarageService[]} services - Expected service storage contracts.
 * @param {string} accessKeyId - Garage access-key identifier.
 * @returns {GarageService | undefined} Matching service contract.
 */
function serviceForAccessKey(services, accessKeyId) {
  for (const service of services) {
    if (service.accessKeyId === accessKeyId) {
      return service;
    }
  }

  return undefined;
}

/**
 * Proves each service key accesses its own bucket and is denied both metadata
 * and object writes against every peer bucket.
 *
 * @param {GarageConfiguration} configurationValue - Validated Garage configuration.
 * @returns {Promise<void>}
 */
async function verifyS3(configurationValue) {
  step = 'authenticated S3 readiness';

  for (const service of configurationValue.services) {
    const client = createS3Client(configurationValue, service);

    try {
      await send(client, new HeadBucketCommand({ Bucket: service.bucket }));

      for (const peer of configurationValue.services) {
        if (peer.bucket === service.bucket) {
          continue;
        }

        let headStatus;

        try {
          await send(client, new HeadBucketCommand({ Bucket: peer.bucket }));
        } catch (error) {
          headStatus = errorStatus(error);
        }

        assert.equal(
          headStatus,
          ACCESS_DENIED_STATUS,
          `${service.name} key can inspect a peer bucket`,
        );

        const probeKey = `.aspectloop-permission-probe/${service.name}`;
        let putStatus;
        let wroteProbe = false;

        try {
          await send(
            client,
            new PutObjectCommand({
              Body: 'permission-probe',
              Bucket: peer.bucket,
              Key: probeKey,
            }),
          );
          wroteProbe = true;
        } catch (error) {
          putStatus = errorStatus(error);
        }

        if (wroteProbe) {
          await removePermissionProbe(configurationValue, peer, probeKey);
        }

        assert.equal(
          putStatus,
          ACCESS_DENIED_STATUS,
          `${service.name} key can write to a peer bucket`,
        );
      }
    } finally {
      client.destroy();
    }
  }

  for (const service of configurationValue.services) {
    const response = await fetch(`${configurationValue.endpoint}/${service.bucket}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(OPERATION_TIMEOUT_MS),
    });

    await response.body?.cancel();
    assert.equal(response.status, ACCESS_DENIED_STATUS, 'Garage bucket allows anonymous access');
  }
}

/**
 * Waits for Garage quorum health after layout application.
 *
 * @param {string} adminEndpoint - Host-side Garage Admin API endpoint.
 * @returns {Promise<void>}
 */
async function waitForHealth(adminEndpoint) {
  step = 'Garage Admin API health';

  for (let attempt = 0; attempt < READINESS_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(`${adminEndpoint}/health`, {
        signal: AbortSignal.timeout(OPERATION_TIMEOUT_MS),
      });

      await response.body?.cancel();

      if (response.status === HEALTHY_STATUS) {
        return;
      }

      assert.equal(response.status, UNAVAILABLE_STATUS, 'Unexpected Garage health status');
    } catch (error) {
      if (attempt === READINESS_ATTEMPTS - 1) {
        throw error;
      }
    }

    await delay(READINESS_DELAY_MS);
  }

  throw new Error('Garage quorum health timed out');
}

/**
 * Waits a bounded interval for the native Garage CLI/RPC path to answer.
 *
 * @param {string} containerName - Garage container name.
 * @returns {Promise<any>} Garage cluster status response.
 */
async function waitForStatus(containerName) {
  for (let attempt = 0; attempt < READINESS_ATTEMPTS; attempt += 1) {
    try {
      return admin(containerName, 'GetClusterStatus');
    } catch {
      if (attempt === READINESS_ATTEMPTS - 1) {
        throw new Error('Garage CLI readiness timed out');
      }

      await delay(READINESS_DELAY_MS);
    }
  }

  throw new Error('Garage CLI readiness timed out');
}

try {
  await main();
} catch (error) {
  console.error(
    `Garage bootstrap failed at ${step} (${errorName(error)}); ` +
      'credentials and response payloads omitted.',
  );
  process.exitCode = 1;
}
