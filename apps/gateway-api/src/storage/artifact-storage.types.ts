export interface ArtifactObject extends ArtifactObjectMetadata {
  body: Uint8Array;
}

export interface ArtifactObjectIdentity {
  key: string;
  objectId: string;
}

export interface ArtifactObjectLocation extends ArtifactObjectIdentity {
  bucket: string;
}

export interface ArtifactObjectMetadata extends ArtifactObjectLocation {
  byteLength: number;
  contentType: string;
  sha256: string;
}

export interface ArtifactOperationContext {
  correlationId?: string;
}

export interface VerifyArtifactObjectInput
  extends ArtifactObjectLocation, ArtifactOperationContext {
  byteLength: number;
  sha256: string;
}

export interface WriteArtifactObjectInput extends ArtifactObjectIdentity, ArtifactOperationContext {
  body: Uint8Array;
  contentType: string;
}
