/** S3 regions use a bounded lower-case identifier compatible with Garage and AWS. */
export const S3_REGION_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

export const MAX_S3_CREDENTIAL_LENGTH = 256;
export const MAX_S3_REQUEST_TIMEOUT_MS = 30_000;
export const LOCAL_GARAGE_CREDENTIAL_PLACEHOLDER = 'generate-with-local-garage-init';
export const AUTH_TOKEN_HMAC_SECRET_PLACEHOLDER = 'replace-with-at-least-32-characters';
export const JWT_ACCESS_SECRET_PLACEHOLDER = 'replace-with-at-least-32-random-bytes';

export const MAX_AUTH_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
export const MIN_AUTH_DURATION_MS = 1000;
export const MAX_AUTH_SECRET_LENGTH = 256;
export const MIN_AUTH_SECRET_LENGTH = 32;
export const MAX_BCRYPT_SALT_ROUNDS = 15;
export const MIN_BCRYPT_SALT_ROUNDS = 4;
export const MAX_JWT_ACCESS_TTL_MS = 15 * 60 * 1000;
export const JWT_CLAIM_VALUE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,127}$/;
