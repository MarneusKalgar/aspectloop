/** S3 regions use a bounded lower-case identifier compatible with Garage and AWS. */
export const S3_REGION_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

export const MAX_S3_CREDENTIAL_LENGTH = 256;
export const MAX_S3_REQUEST_TIMEOUT_MS = 30_000;
export const LOCAL_GARAGE_CREDENTIAL_PLACEHOLDER = 'generate-with-local-garage-init';
