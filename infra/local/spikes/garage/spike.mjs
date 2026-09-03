import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const directory = fileURLToPath(new URL('.', import.meta.url));
const envFile = fileURLToPath(new URL('.env.local', import.meta.url));
const project = 'aspectloop_m04b_garage';
const bucket = 'm04b-source';
const deniedBucket = 'm04b-denied';
const capacity = 1_000_000_000;
const zone = 'local';
const region = 'garage';
const endpoint = 'http://127.0.0.1:43900';
const healthEndpoint = 'http://127.0.0.1:43903/health';
let step = 'arguments';

/**
 * Calls Garage over RPC; no-argument request types require JSON null, not an empty object.
 * Payloads stay on stdin so key-import credentials never enter command arguments.
 */
function admin(operation, payload = null) {
  try {
    return JSON.parse(
      compose(
        ['exec', '-T', 'garage', '/garage', 'json-api', operation, '-'],
        JSON.stringify(payload),
      ),
    );
  } finally {
    step = `admin ${operation}`;
  }
}

/** Bootstraps one known node, private buckets, and a key without expanding an existing layout. */
function bootstrap() {
  const env = configuration();
  const status = admin('GetClusterStatus');
  assert.equal(status.nodes.length, 1, 'Spike must have exactly one node');
  const node = status.nodes[0];
  assert.equal(node.isUp, true, 'Spike node is disconnected');
  const layout = admin('GetClusterLayout');
  assert.equal(layout.stagedRoleChanges.length, 0, 'Unexpected staged layout changes');
  if (layout.version === 0 && layout.roles.length === 0) {
    admin('UpdateClusterLayout', { roles: [{ capacity, id: node.id, tags: [], zone }] });
    admin('ApplyClusterLayout', { version: 1 });
  }
  const applied = admin('GetClusterLayout');
  assert.equal(applied.version, 1, 'Unexpected layout version; do not repair automatically');
  assert.equal(applied.roles.length, 1, 'Unexpected storage-node count');
  assert.equal(applied.roles[0].id, node.id, 'Unexpected storage node');
  assert.equal(applied.roles[0].zone, zone, 'Unexpected storage zone');
  assert.equal(applied.roles[0].capacity, capacity, 'Unexpected storage capacity');

  const keys = admin('ListKeys');
  assert.ok(keys.length <= 1, 'Unexpected keys in disposable cluster');
  if (keys.length === 0) {
    admin('ImportKey', {
      accessKeyId: env.M04B_ACCESS_KEY_ID,
      name: 'm04b-probe',
      secretAccessKey: env.M04B_SECRET_ACCESS_KEY,
    });
  } else {
    assert.equal(
      keys[0].id,
      env.M04B_ACCESS_KEY_ID,
      'Existing spike key does not match local config',
    );
    assert.equal(keys[0].expired, false, 'Spike key has expired');
  }
  let source;
  const buckets = admin('ListBuckets');
  assert.ok(buckets.length <= 2, 'Unexpected buckets in disposable cluster');
  for (const candidate of buckets) {
    assert.equal(candidate.globalAliases.length, 1, 'Unexpected bucket aliases');
    assert.ok([bucket, deniedBucket].includes(candidate.globalAliases[0]), 'Unexpected bucket');
  }
  for (const name of [bucket, deniedBucket]) {
    let found;
    for (const candidate of buckets) {
      if (candidate.globalAliases.includes(name)) found = candidate;
    }
    const result = found ?? admin('CreateBucket', { globalAlias: name });
    if (name === bucket) source = result;
  }
  admin('AllowBucketKey', {
    accessKeyId: env.M04B_ACCESS_KEY_ID,
    bucketId: source.id,
    permissions: { owner: false, read: true, write: true },
  });
  console.log('Bootstrap: one node, layout v1, two private buckets, one bucket-scoped key.');
}

/** Runs only this fixed Compose project, with bounded execution and no raw secret-bearing output. */
function compose(args, input, timeout = 30_000) {
  step = `docker ${args[0]}`;
  const env = { ...process.env, ...configuration(), COMPOSE_PROFILES: '' };
  delete env.COMPOSE_FILE;
  delete env.COMPOSE_ENV_FILES;
  try {
    return execFileSync(
      'docker',
      [
        'compose',
        '--project-name',
        project,
        '--project-directory',
        directory,
        '--env-file',
        envFile,
        '--file',
        `${directory}compose.yml`,
        ...args,
      ],
      { encoding: 'utf8', env, input, maxBuffer: 1024 * 1024, stdio: 'pipe', timeout },
    );
  } catch {
    throw new Error(
      `Spike Docker step ${args[0]} failed or timed out; inspect this project locally.`,
    );
  }
}

/** Loads only the spike configuration; shell AWS/application credentials are never used. */
function configuration() {
  const env = parseEnv(readFileSync(envFile, 'utf8'));
  const platform = process.env.M04B_PLATFORM ?? env.M04B_PLATFORM;
  assert.ok(['linux/amd64', 'linux/arm64'].includes(platform), 'Unsupported spike platform');
  assert.match(env.GARAGE_RPC_SECRET ?? '', /^[a-f0-9]{64}$/, 'Invalid spike RPC secret');
  assert.match(env.M04B_ACCESS_KEY_ID ?? '', /^GK[a-f0-9]{24}$/, 'Invalid spike key ID');
  assert.match(env.M04B_SECRET_ACCESS_KEY ?? '', /^[a-f0-9]{64}$/, 'Invalid spike secret');
  return { ...env, M04B_PLATFORM: platform };
}

/** Checks the unauthenticated host health endpoint without exposing any administrative token. */
async function health() {
  step = 'host health';
  const response = await fetch(healthEndpoint, { signal: AbortSignal.timeout(5000) });
  await response.body?.cancel();
  assert.ok([200, 503].includes(response.status), 'Unexpected Garage health response');
  console.log(`Host GET /health: ${response.status}`);
  return response.status;
}

/** Creates private, disposable credentials without reading application environment files. */
function initialize() {
  const platform =
    process.env.M04B_PLATFORM ?? `linux/${process.arch === 'arm64' ? 'arm64' : 'amd64'}`;
  assert.ok(['linux/amd64', 'linux/arm64'].includes(platform), 'Unsupported spike platform');
  const content = [
    `M04B_PLATFORM=${platform}`,
    `GARAGE_RPC_SECRET=${randomBytes(32).toString('hex')}`,
    `M04B_ACCESS_KEY_ID=GK${randomBytes(12).toString('hex')}`,
    `M04B_SECRET_ACCESS_KEY=${randomBytes(32).toString('hex')}`,
    '',
  ].join('\n');
  try {
    writeFileSync(envFile, content, { flag: 'wx', mode: 0o600 });
    console.log('Created ignored spike .env.local; do not commit or share it.');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log('Keeping existing spike credentials.');
  }
}

/** Dispatches explicit human actions; normal stop and destructive reset are separate commands. */
async function main() {
  const [action, confirmation, ...extra] = process.argv.slice(2);
  assert.equal(extra.length, 0, 'Unexpected arguments');
  if (action !== 'reset') assert.equal(confirmation, undefined, 'Unexpected argument');
  switch (action) {
    case 'bootstrap':
      bootstrap();
      break;
    case 'down':
      compose(['down', '--remove-orphans']);
      console.log('Spike stopped; its volumes and local credentials are preserved.');
      break;
    case 'help':
    case undefined:
      console.log(
        'Use init, up, bootstrap, verify-empty, verify, restart, down, or reset --confirm-disposable.',
      );
      break;
    case 'init':
      initialize();
      break;
    case 'reset':
      assert.equal(confirmation, '--confirm-disposable', 'Reset requires --confirm-disposable');
      compose(['down', '--volumes', '--remove-orphans']);
      console.log('Only the fixed M04-B project volumes were removed; credentials remain local.');
      break;
    case 'restart':
      compose(['restart', 'garage']);
      compose(['up', '-d', '--wait', '--wait-timeout', '90'], undefined, 120_000);
      await verify('read');
      break;
    case 'up':
      compose(['up', '-d', '--wait', '--wait-timeout', '90'], undefined, 300_000);
      console.log('Bounded /garage status passed; bucket readiness is not established yet.');
      await health();
      break;
    case 'verify':
      await verify('write');
      break;
    case 'verify-empty':
      await verify('empty');
      break;
    default:
      throw new Error('Use init, up, bootstrap, verify, verify-empty, restart, down, or reset.');
  }
}

/** Exercises the real AWS SDK only after the human has installed the declared dev dependencies. */
async function verify(mode) {
  const env = configuration();
  step = 'load AWS SDK (run npm install first)';
  const { verifyS3 } = await import('./verify-s3.mjs');
  await waitForHealth();
  const cluster = admin('GetClusterHealth');
  assert.equal(cluster.status, 'healthy', 'Cluster is not fully healthy');
  step = `S3 ${mode}`;
  await verifyS3({
    bucket,
    credentials: {
      accessKeyId: env.M04B_ACCESS_KEY_ID,
      secretAccessKey: env.M04B_SECRET_ACCESS_KEY,
    },
    deniedBucket,
    endpoint,
    mode,
    region,
  });
  console.log(`PASS: ${mode}; platform=${env.M04B_PLATFORM}; Garage=2.3.0`);
}

/** Allows bounded convergence after layout application or a normal restart. */
async function waitForHealth() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if ((await health()) === 200) return;
    await delay(1000);
  }
  throw new Error('Garage quorum did not become ready');
}

try {
  await main();
} catch (error) {
  // SDK, fetch, and assertion errors can contain credentials, URLs, or response bodies.
  console.error(
    `M04-B failed at ${step} (${error.name}); no acceptance recorded. See the spike README.`,
  );
  process.exitCode = 1;
}
