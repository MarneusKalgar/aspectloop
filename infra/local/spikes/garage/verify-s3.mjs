import {
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const bytes = Buffer.from('AspectLoop M04-B disposable S3 compatibility fixture\n');
const checksum = createHash('sha256').update(bytes).digest('hex');
const contentType = 'text/plain';
const keys = ['probe/sdk-object', 'probe/presigned-object'];

/** Performs SDK operations and host-origin SigV4 GET/PUT; read mode never recreates lost objects. */
export async function verifyS3({ bucket, credentials, deniedBucket, endpoint, mode, region }) {
  const client = new S3Client({
    credentials,
    endpoint,
    forcePathStyle: true,
    maxAttempts: 1,
    region,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  try {
    await send(client, new HeadBucketCommand({ Bucket: bucket }));
    await verifyDeniedBucket(client, deniedBucket);
    console.log('PASS: authenticated HeadBucket; unrelated bucket denied.');
    if (mode === 'empty') {
      const list = await send(client, new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
      assert.equal(list.Contents?.length ?? 0, 0, 'Reset left objects in the source bucket');
      console.log('PASS: freshly bootstrapped source bucket is empty.');
      return;
    }
    if (mode === 'write') {
      await send(
        client,
        new PutObjectCommand({
          Body: bytes,
          Bucket: bucket,
          ContentType: contentType,
          Key: keys[0],
          Metadata: { purpose: 'm04b', sha256: checksum },
        }),
      );
      const putUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          ContentType: contentType,
          Key: keys[1],
          Metadata: { purpose: 'm04b', sha256: checksum },
        }),
        {
          expiresIn: 60,
          signableHeaders: new Set(['content-type']),
          unhoistableHeaders: new Set(['x-amz-meta-purpose', 'x-amz-meta-sha256']),
        },
      );
      const put = await fetch(putUrl, {
        body: bytes,
        headers: {
          'content-type': contentType,
          'x-amz-meta-purpose': 'm04b',
          'x-amz-meta-sha256': checksum,
        },
        method: 'PUT',
        signal: AbortSignal.timeout(5000),
      });
      await put.body?.cancel();
      assert.equal(put.status, 200, 'Presigned PUT failed');
      console.log('PASS: SDK PutObject and presigned PUT.');
    }
    for (const key of keys) await readObject(client, bucket, key);
    console.log('PASS: HeadObject/GetObject, size, content type, metadata and SHA-256 (not ETag).');

    const getUrl = await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: keys[1] }),
      { expiresIn: 60 },
    );
    const get = await fetch(getUrl, { signal: AbortSignal.timeout(5000) });
    assert.equal(get.status, 200, 'Presigned GET failed');
    assert.equal(
      sha256(Buffer.from(await get.arrayBuffer())),
      checksum,
      'Presigned GET checksum mismatch',
    );

    const anonymous = await fetch(`${endpoint}/${bucket}/${keys[0]}`, {
      signal: AbortSignal.timeout(5000),
    });
    await anonymous.body?.cancel();
    assert.equal(anonymous.status, 403, 'Private object allowed anonymous access');
    console.log('PASS: presigned GET; anonymous GET denied.');
  } finally {
    client.destroy();
  }
}

/** Checks bytes and metadata using independent S3 operations and the application checksum. */
async function readObject(client, bucket, key) {
  const head = await send(client, new HeadObjectCommand({ Bucket: bucket, Key: key }));
  assert.equal(head.ContentLength, bytes.length, 'Object size mismatch');
  assert.equal(head.ContentType, contentType, 'Content type mismatch');
  assert.equal(head.Metadata?.sha256, checksum, 'SHA-256 metadata mismatch');
  assert.equal(head.Metadata?.purpose, 'm04b', 'Custom metadata did not round-trip');
  const object = await send(client, new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await object.Body.transformToByteArray();
  assert.equal(body.length, bytes.length, 'Downloaded size mismatch');
  assert.equal(sha256(body), checksum, 'Downloaded checksum mismatch');
}

/** Sends one bounded SDK request without ambient credentials, SDK retries, or raw error logging. */
function send(client, command) {
  return client.send(command, { abortSignal: AbortSignal.timeout(5000) });
}

/** Computes an application SHA-256 without depending on provider-specific ETag semantics. */
function sha256(body) {
  return createHash('sha256').update(body).digest('hex');
}

/** Proves credentials cannot access an existing ungranted bucket, rather than a missing bucket. */
async function verifyDeniedBucket(client, bucket) {
  let status;
  try {
    await send(client, new HeadBucketCommand({ Bucket: bucket }));
  } catch (error) {
    status = error.$metadata?.httpStatusCode;
  }
  assert.equal(status, 403, 'Expected access denied for the ungranted bucket');
}
